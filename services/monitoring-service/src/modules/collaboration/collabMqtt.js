const mqtt = require("mqtt");
const { TOPICS, ENABLED, adaptTelemetry, kindOf } = require("./collabTopics");
const { recordMqttReceived, recordMqttFailed } = require("../ingest/ingestMetrics");

/**
 * Langganan MQTT kontrak kolaborasi robot — hidup di role `collector`.
 *
 * Sengaja memakai koneksi MQTT SENDIRI (bukan klien sensor milik mqttService):
 * handler pesan klien itu memproses semua topik yang diterimanya sebagai frame
 * sensor, sehingga menumpang langganan di sana akan menyeret pesan misi ke
 * q.ingest. Seperti collector, JANGAN dijalankan lebih dari satu instance per
 * broker (atau pakai shared subscription MQTT v5).
 *
 * @param {(job:object)=>Promise} enqueueIngest  telemetri → q.ingest (jalur sensor yang ada)
 * @param {(job:object)=>Promise} enqueueCollab  misi & aktuasi → q.collab
 */
function connectCollabMqtt(enqueueIngest, enqueueCollab) {
  if (!ENABLED || !process.env.MQTT_BROKER_URL) {
    console.warn("[collab-mqtt] nonaktif (COLLAB_ENABLED=false atau MQTT_BROKER_URL kosong)");
    return null;
  }
  const client = mqtt.connect(process.env.MQTT_BROKER_URL, {
    clientId: `shms-collab-${process.pid}-${Math.random().toString(16).slice(2, 8)}`,
  });
  const baseTopics = Object.values(TOPICS);
  const wildcardTopics = [
    "+/mission/status",
    "+/mission/result",
    "+/agent/mission/status",
    "+/agent/mission/result",
    "+/actuator/control",
    "+/mission/command",
    "+/agent/mission/command",
  ];
  const topics = Array.from(new Set([...baseTopics, ...wildcardTopics]));

  client.on("connect", () => {
    client.subscribe(topics, { qos: 1 }, (err) => {
      if (err) console.error("[collab-mqtt] gagal subscribe:", err.message);
      else {
        console.log("[collab-mqtt] subscribed:", topics.join(", "));
        if (process.env.JETSON_DIRECT_ENABLED === "true") {
          console.log("[collab-mqtt] mode langsung Jetson Nano WiFi aktif");
        }
      }
    });
  });
  client.on("error", (err) => console.error("[collab-mqtt]", err.message));

  client.on("message", async (topic, message) => {
    // Relay Sink Node RW612 otomatis:
    // gh01/agent/mission/status -> gh01/mission/status
    // gh01/agent/mission/result -> gh01/mission/result
    // gh01/mission/command      -> gh01/agent/mission/command
    if (topic.includes("/agent/mission/status")) {
      const relayTopic = topic.replace("/agent/mission/status", "/mission/status");
      client.publish(relayTopic, message, { qos: 1 });
    } else if (topic.includes("/agent/mission/result")) {
      const relayTopic = topic.replace("/agent/mission/result", "/mission/result");
      client.publish(relayTopic, message, { qos: 1 });
    } else if (!topic.includes("/agent/") && topic.endsWith("/mission/command")) {
      const relayTopic = topic.replace(/\/mission\/command$/, "/agent/mission/command");
      client.publish(relayTopic, message, { qos: 1 });
    }

    const kind = kindOf(topic);
    if (!kind) return;
    recordMqttReceived();
    try {
      const payload = JSON.parse(message.toString());
      const receivedAt = new Date().toISOString();
      if (kind === "telemetry") {
        const data = adaptTelemetry(payload);
        if (!data) throw new Error("telemetry tanpa h_id/n_id");
        await enqueueIngest({ source: "mqtt-collab", data, topicParts: topic.split("/"),
          screenhouseIdFromTopic: null, receivedAt });
      } else {
        await enqueueCollab({ kind, topic, payload, receivedAt });
      }
    } catch (err) {
      recordMqttFailed();
      console.log(`[collab-mqtt] gagal memproses ${topic}:`, err.message);
    }
  });
  return client;
}

module.exports = { connectCollabMqtt };
