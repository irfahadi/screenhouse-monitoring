# Panduan Pengujian Manual: Reset, cURL Trigger, dan Sekuensial MQTT Inspeksi

Dokumen ini berisi panduan langkah-demi-langkah untuk melakukan pengujian manual pada sistem monitoring screenhouse (`http://localhost:8082/petani/screenhouse/90`).

Anda dapat menyalin (*copy-paste*) perintah di bawah ini secara manual satu per satu di terminal.

---

## Ringkasan Alur Pengujian

```
[1. Reset DB] ──> [2. cURL Trigger Misi] ──> [3. Sekuensial Publish MQTT (Robot)] ──> [4. UI Terupdate 100%]
```

---

## Langkah 0: Reset Status & Data Inspeksi

Jalankan perintah ini di terminal host/WSL untuk mengosongkan data misi & tray inspeksi sebelumnya agar dashboard bersih:

```bash
docker exec screenhouse-postgres-monitoring psql -U postgres -d screenhouse_monitoring -c \
  "DELETE FROM tray_inspections; DELETE FROM robot_mission_events; DELETE FROM robot_missions; DELETE FROM actuation_events WHERE screenhouse_id = 90;"
```

> **Verifikasi di UI:** Buka `http://localhost:8082/petani/screenhouse/90`. Bagian inspeksi bibit akan berada pada kondisi awal (tidak ada misi aktif berjalan).

---

## Langkah 1: Trigger Misi Inspeksi via cURL

Misi dipicu menggunakan REST API dengan kredensial Petani (Pak Eko, user ID = 1, Screenhouse ID = 90).

### 1.1 Buat Token JWT Petani & Simpan ke Variabel
Jalankan perintah berikut di terminal:

```bash
TOKEN=$(docker exec screenhouse-collector node -e "console.log(require('jsonwebtoken').sign({ id: 1, role: 'petani', name: 'Pak Eko' }, 'supersecret', { expiresIn: '1d' }));")
```

### 1.2 Kirim Perintah cURL POST Misi
```bash
curl -X POST "http://localhost:8082/api/missions/screenhouse/90" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"trays":[1,2,3,4]}'
```

**Contoh Output Respons:**
```json
{
  "mission": {
    "mission_code": "M20261118-095500",
    "screenhouse_id": 90,
    "status": "ISSUED",
    "trays": [1, 2, 3, 4]
  }
}
```

> **CATAT KODE MISI (`mission_code`)**: Misalnya `M20261118-095500`.  
> Simpan kode misi ke variabel shell agar mudah digunakan pada langkah berikutnya:
> ```bash
> export M_ID="M20261118-095500"
> ```
> *(Ganti nilainya sesuai kode misi yang dihasilkan respons cURL Anda).*

> **Efek di UI:** Dashboard `http://localhost:8082/petani/screenhouse/90` langsung menampilkan status **"Menunggu robot (0%)"**.

---

## Langkah 2: Eksekusi Manual Sekuensial MQTT (Simulasi Robot)

Perintah MQTT di bawah dapat dijalankan melalui **2 cara**:
1. **Dari Terminal Lokal / Host:** Menggunakan `docker exec screenhouse-mqtt mosquitto_pub ...`
2. **Dari Jetson Nano:** Menggunakan `mosquitto_pub -h 10.178.10.1 ...` (mengarah ke IP WiFi PC Anda).

Berikut adalah urutan sekuensial dari awal sampai selesai:

---

### Step 2.1: Robot Mengonfirmasi Penerimaan Misi (`ACCEPTED`)
Robot menandakan telah menerima perintah misi dari sistem.

**Perintah (Docker Lokal):**
```bash
docker exec screenhouse-mqtt mosquitto_pub -t "gh01/agent/mission/status" -m "{\"m_id\":\"$M_ID\",\"r_id\":\"RB01\",\"st\":\"ACCEPTED\",\"bat\":98,\"ts\":$(date +%s)}"
```
**Perintah (Dari Jetson Nano):**
```bash
mosquitto_pub -h 10.178.10.1 -t "gh01/agent/mission/status" -m "{\"m_id\":\"$M_ID\",\"r_id\":\"RB01\",\"st\":\"ACCEPTED\",\"bat\":98,\"ts\":$(date +%s)}"
```
* **Efek di UI:** Status berubah menjadi **"Misi diterima robot"**.

---

### Step 2.2: Robot Mulai Menuju & Memeriksa Tray 1 (`IN_PROGRESS`, 10%)

```bash
docker exec screenhouse-mqtt mosquitto_pub -t "gh01/agent/mission/status" -m "{\"m_id\":\"$M_ID\",\"r_id\":\"RB01\",\"st\":\"IN_PROGRESS\",\"cur_tray\":1,\"pct\":10,\"bat\":96,\"ts\":$(date +%s)}"
```
* **Efek di UI:** Status "Inspeksi Berjalan", Tray aktif: **Tray 1**, progress bar: **10%**.

---

### Step 2.3: Robot Mengirimkan Hasil Deteksi Tray 1 (`BAGUS`)

```bash
docker exec screenhouse-mqtt mosquitto_pub -t "gh01/agent/mission/result" -m "{\"m_id\":\"$M_ID\",\"r_id\":\"RB01\",\"t_idx\":1,\"status\":\"BAGUS\",\"healthy\":24,\"unhealthy\":1,\"empty\":0,\"pest\":0,\"conf\":0.96,\"ts\":$(date +%s)}"
```
* **Efek di UI:** Kartu **Tray 1** terisi data dan berwarna hijau (24 sehat, 1 tidak sehat).

---

### Step 2.4: Robot Menuju & Memeriksa Tray 2 (`IN_PROGRESS`, 35%)

```bash
docker exec screenhouse-mqtt mosquitto_pub -t "gh01/agent/mission/status" -m "{\"m_id\":\"$M_ID\",\"r_id\":\"RB01\",\"st\":\"IN_PROGRESS\",\"cur_tray\":2,\"pct\":35,\"bat\":94,\"ts\":$(date +%s)}"
```
* **Efek di UI:** Tray aktif berpindah ke **Tray 2**, progress bar naik ke **35%**.

---

### Step 2.5: Robot Mengirimkan Hasil Deteksi Tray 2 (`BAGUS`)

```bash
docker exec screenhouse-mqtt mosquitto_pub -t "gh01/agent/mission/result" -m "{\"m_id\":\"$M_ID\",\"r_id\":\"RB01\",\"t_idx\":2,\"status\":\"BAGUS\",\"healthy\":25,\"unhealthy\":0,\"empty\":0,\"pest\":0,\"conf\":0.98,\"ts\":$(date +%s)}"
```
* **Efek di UI:** Kartu **Tray 2** terisi data dan berwarna hijau (25 sehat).

---

### Step 2.6: Robot Menuju & Memeriksa Tray 3 (`IN_PROGRESS`, 60%)

```bash
docker exec screenhouse-mqtt mosquitto_pub -t "gh01/agent/mission/status" -m "{\"m_id\":\"$M_ID\",\"r_id\":\"RB01\",\"st\":\"IN_PROGRESS\",\"cur_tray\":3,\"pct\":60,\"bat\":91,\"ts\":$(date +%s)}"
```
* **Efek di UI:** Tray aktif berpindah ke **Tray 3**, progress bar naik ke **60%**.

---

### Step 2.7: Robot Mengirimkan Hasil Deteksi Tray 3 (`TIDAK_BAGUS`)

```bash
docker exec screenhouse-mqtt mosquitto_pub -t "gh01/agent/mission/result" -m "{\"m_id\":\"$M_ID\",\"r_id\":\"RB01\",\"t_idx\":3,\"status\":\"TIDAK_BAGUS\",\"healthy\":14,\"unhealthy\":8,\"empty\":3,\"pest\":2,\"conf\":0.91,\"ts\":$(date +%s)}"
```
* **Efek di UI:** Kartu **Tray 3** berubah merah/kuning tanda ada masalah (14 sehat, 8 tidak sehat, 2 hama).

---

### Step 2.8: Robot Menuju & Memeriksa Tray 4 (`IN_PROGRESS`, 85%)

```bash
docker exec screenhouse-mqtt mosquitto_pub -t "gh01/agent/mission/status" -m "{\"m_id\":\"$M_ID\",\"r_id\":\"RB01\",\"st\":\"IN_PROGRESS\",\"cur_tray\":4,\"pct\":85,\"bat\":89,\"ts\":$(date +%s)}"
```
* **Efek di UI:** Tray aktif berpindah ke **Tray 4**, progress bar naik ke **85%**.

---

### Step 2.9: Robot Mengirimkan Hasil Deteksi Tray 4 (`BAGUS`)

```bash
docker exec screenhouse-mqtt mosquitto_pub -t "gh01/agent/mission/result" -m "{\"m_id\":\"$M_ID\",\"r_id\":\"RB01\",\"t_idx\":4,\"status\":\"BAGUS\",\"healthy\":23,\"unhealthy\":2,\"empty\":0,\"pest\":0,\"conf\":0.95,\"ts\":$(date +%s)}"
```
* **Efek di UI:** Kartu **Tray 4** terisi data dan berwarna hijau.

---

### Step 2.10: Robot Menyelesaikan Misi (`COMPLETED`, 100%)

```bash
docker exec screenhouse-mqtt mosquitto_pub -t "gh01/agent/mission/status" -m "{\"m_id\":\"$M_ID\",\"r_id\":\"RB01\",\"st\":\"COMPLETED\",\"cur_tray\":null,\"pct\":100,\"bat\":87,\"ts\":$(date +%s)}"
```
* **Efek di UI:** 
  - Status misi berubah menjadi **"COMPLETED / Selesai"**.
  - Progress bar mencapai **100%**.
  - Data seluruh 4 tray tersimpan permanen di database dan muncul pada tabel riwayat inspeksi.

---

## Catatan Topik MQTT yang Didukung

Broker dan backend telah dikonfigurasi untuk menerima kedua format topik berikut:
1. **Dengan Prefix Rumah Kaca (Disarankan):**
   - Status: `gh01/agent/mission/status` atau `gh01/mission/status`
   - Hasil Tray: `gh01/agent/mission/result` atau `gh01/mission/result`
2. **Topik Standar:**
   - Status: `mission/status`
   - Hasil Tray: `mission/result`
