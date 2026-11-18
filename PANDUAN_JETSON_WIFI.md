# Panduan Konfigurasi Broker MQTT Komputer Lokal untuk Jetson Nano (ROS 2 Humble)

Dokumen ini berisi informasi alamat broker, port, dan kontrak topik MQTT agar perangkat **Jetson Nano (ROS 2 Humble)** milik Anda dapat langsung mengirim dan menerima data ke **Dashboard Web** di komputer lokal melalui jaringan WiFi lokal (baik secara direct maupun melalui Sink Node NPA-VEE-RW612).

---

## 1. Informasi Broker MQTT Komputer Lokal

Broker Mosquitto di komputer lokal sudah dikonfigurasi dan aktif:

- **Protokol:** MQTT (TCP)
- **Host / IP Komputer Lokal:** `10.66.20.96` *(cek kembali IP WiFi Anda dengan `ipconfig` di Windows jika berpindah jaringan)*
- **Port:** `1883` *(listener bind ke `0.0.0.0`)*
- **Port WebSocket (opsional):** `9001`
- **Autentikasi:** Anonymous (tanpa username & password)

> [!TIP]
> Pastikan Jetson Nano dan Komputer Lokal terhubung ke jaringan WiFi/router yang sama. Uji koneksi dari Jetson ke komputer dengan:
> ```bash
> ping 10.66.20.96
> ```

---

## 2. Alur Data ke Dashboard Web

```
┌────────────────────────────┐
│ Jetson Nano (ROS 2 Humble) │
│ - Robot Controller / Sim   │
│ - Vision Node (YOLOv8/TRT) │
└─────────────┬──────────────┘
              │
              │ WiFi Lokal (MQTT :1883)
              ▼
┌────────────────────────────┐
│  Sink Node / WiFi Broker   │
│     (Mosquitto :1883)      │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│  monitoring-service        │
│  - collector (collabMqtt)  │
│  - collaboration listener  │
└─────────────┬──────────────┘
              │
              │ Socket.IO Realtime
              ▼
┌────────────────────────────┐
│   Web Dashboard (React)    │
│  Panel Inspeksi Robot      │
└────────────────────────────┘
```

---

## 3. Kontrak Topik & Format JSON

Anda cukup mengarahkan node ROS 2 di Jetson Nano untuk publish/subscribe ke topik-topik berikut:

### A. Menerima Perintah Misi dari Dashboard
- **Topik Subscribe di Jetson:**
  - `mission/command` *(mode direct)* **ATAU**
  - `gh01/agent/mission/command` *(mode sink node relay)*
- **Format Payload (JSON):**
  ```json
  {
    "m_id": "M20261118-01",
    "h_id": "GH01",
    "cmd": "INSPECT",
    "trays": [1, 2, 3, 4],
    "crit_lvl": 1,
    "ts": 1763456789000
  }
  ```
  *(Jika `cmd == "ABORT"`, robot harus membatalkan misi).*

### B. Mengirim Status Progres ke Dashboard
- **Topik Publish dari Jetson:**
  - `mission/status` *(mode direct)* **ATAU**
  - `gh01/agent/mission/status` *(mode sink node relay)*
- **Interval:** Dikirim periodik tiap 2–5 detik saat misi berjalan.
- **Format Payload (JSON):**
  ```json
  {
    "m_id": "M20261118-01",
    "r_id": "RB01",
    "st": "IN_PROGRESS",
    "cur_tray": 1,
    "pct": 25,
    "bat": 90,
    "seq": 1,
    "ts": 1763456789000
  }
  ```
  *Nilai `st` yang valid: `ACCEPTED`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `REJECTED`.*

### C. Mengirim Hasil Inspeksi Mutu Tray ke Dashboard
- **Topik Publish dari Jetson:**
  - `mission/result` *(mode direct)* **ATAU**
  - `gh01/agent/mission/result` *(mode sink node relay)*
- **Format Payload (JSON):**
  ```json
  {
    "m_id": "M20261118-01",
    "h_id": "GH01",
    "tray_id": 1,
    "label": "BAGUS",
    "conf": 0.95,
    "h_cm": 14.2,
    "anom": 0,
    "seq": 1,
    "ts": 1763456795000
  }
  ```
  *Nilai `label`: `"BAGUS"` atau `"TIDAK_BAGUS"`.*

---

## 4. Konfigurasi pada Node ROS 2 di Jetson Nano

Pada konfigurasi node ROS 2 di Jetson Nano Anda:
1. Set parameter broker host ke IP komputer lokal Anda:
   ```yaml
   mqtt_broker: "10.66.20.96"   # IP komputer lokal Anda di WiFi
   mqtt_port: 1883
   ```
2. Jalankan node Anda di Jetson. Begitu terhubung dan mengirim pesan status atau result, data akan langsung muncul secara otomatis di panel **Inspeksi Mutu Bibit oleh Robot** pada dashboard website tanpa perlu me-refresh halaman!
