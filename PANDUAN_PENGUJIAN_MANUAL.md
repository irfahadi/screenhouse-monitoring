# Panduan Pengujian Manual dari Jetson Nano

Panduan ini berisi langkah-demi-langkah pengujian dari Jetson Nano ke broker di PC (`10.178.10.1`) untuk mengupdate status dan hasil inspeksi secara realtime pada dashboard:  
👉 **http://localhost:8082/petani/screenhouse/90**

---

## Langkah 0: Reset Status & Database (Dijalankan di Terminal PC)

Jalankan perintah ini di terminal PC/WSL untuk membersihkan riwayat inspeksi sebelumnya:

```bash
docker exec screenhouse-postgres-monitoring psql -U postgres -d screenhouse_monitoring -c \
  "DELETE FROM tray_inspections; DELETE FROM robot_mission_events; DELETE FROM robot_missions; DELETE FROM actuation_events WHERE screenhouse_id = 90;"
```

---

## Langkah 1: Trigger Misi Baru via cURL (Dijalankan di Terminal PC)

Buat misi baru untuk Screenhouse 90:

```bash
TOKEN=$(docker exec screenhouse-collector node -e "console.log(require('jsonwebtoken').sign({ id: 1, role: 'petani', name: 'Pak Eko' }, 'supersecret', { expiresIn: '1d' }));")

curl -X POST "http://localhost:8082/api/missions/screenhouse/90" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"trays":[1,2,3,4]}'
```

Output respons cURL akan memuat kode misi, misalnya:
`"mission_code":"M20261118-095500"`

> **Catat kode misi tersebut** untuk digunakan pada langkah selanjutnya di Jetson Nano.

---

## Langkah 2: Update Progress dari Terminal Jetson Nano

Buka terminal di **Jetson Nano**, lalu set variabel IP broker dan Kode Misi:

```bash
export BROKER_IP="10.178.10.1"
export M_ID="M20261118-095500"
```
*(Ganti nilai `M_ID` sesuai kode misi dari Langkah 1)*

Jalankan perintah `mosquitto_pub` berikut secara berurutan:

---

### 1. Robot Konfirmasi Terima Misi (`ACCEPTED`)
```bash
mosquitto_pub -h $BROKER_IP -t "gh01/agent/mission/status" -m "{\"m_id\":\"$M_ID\",\"r_id\":\"RB01\",\"st\":\"ACCEPTED\",\"bat\":98,\"ts\":$(date +%s)}"
```
*Status UI: Misi diterima robot.*

---

### 2. Robot Menuju Tray 1 (`IN_PROGRESS`, 10%)
```bash
mosquitto_pub -h $BROKER_IP -t "gh01/agent/mission/status" -m "{\"m_id\":\"$M_ID\",\"r_id\":\"RB01\",\"st\":\"IN_PROGRESS\",\"cur_tray\":1,\"pct\":10,\"bat\":96,\"ts\":$(date +%s)}"
```
*Status UI: Tray aktif = Tray 1, Progress = 10%.*

---

### 3. Kirim Hasil Deteksi Tray 1 (`BAGUS`)
```bash
mosquitto_pub -h $BROKER_IP -t "gh01/agent/mission/result" -m "{\"m_id\":\"$M_ID\",\"r_id\":\"RB01\",\"t_idx\":1,\"status\":\"BAGUS\",\"healthy\":24,\"unhealthy\":1,\"empty\":0,\"pest\":0,\"conf\":0.96,\"ts\":$(date +%s)}"
```
*Status UI: Tray 1 terisi (24 sehat, 1 tidak sehat).*

---

### 4. Robot Menuju Tray 2 (`IN_PROGRESS`, 35%)
```bash
mosquitto_pub -h $BROKER_IP -t "gh01/agent/mission/status" -m "{\"m_id\":\"$M_ID\",\"r_id\":\"RB01\",\"st\":\"IN_PROGRESS\",\"cur_tray\":2,\"pct\":35,\"bat\":94,\"ts\":$(date +%s)}"
```
*Status UI: Tray aktif = Tray 2, Progress = 35%.*

---

### 5. Kirim Hasil Deteksi Tray 2 (`BAGUS`)
```bash
mosquitto_pub -h $BROKER_IP -t "gh01/agent/mission/result" -m "{\"m_id\":\"$M_ID\",\"r_id\":\"RB01\",\"t_idx\":2,\"status\":\"BAGUS\",\"healthy\":25,\"unhealthy\":0,\"empty\":0,\"pest\":0,\"conf\":0.98,\"ts\":$(date +%s)}"
```
*Status UI: Tray 2 terisi (25 sehat).*

---

### 6. Robot Menuju Tray 3 (`IN_PROGRESS`, 60%)
```bash
mosquitto_pub -h $BROKER_IP -t "gh01/agent/mission/status" -m "{\"m_id\":\"$M_ID\",\"r_id\":\"RB01\",\"st\":\"IN_PROGRESS\",\"cur_tray\":3,\"pct\":60,\"bat\":91,\"ts\":$(date +%s)}"
```
*Status UI: Tray aktif = Tray 3, Progress = 60%.*

---

### 7. Kirim Hasil Deteksi Tray 3 (`TIDAK_BAGUS`)
```bash
mosquitto_pub -h $BROKER_IP -t "gh01/agent/mission/result" -m "{\"m_id\":\"$M_ID\",\"r_id\":\"RB01\",\"t_idx\":3,\"status\":\"TIDAK_BAGUS\",\"healthy\":14,\"unhealthy\":8,\"empty\":3,\"pest\":2,\"conf\":0.91,\"ts\":$(date +%s)}"
```
*Status UI: Tray 3 terisi warna peringatan (14 sehat, 8 tidak sehat, 2 hama).*

---

### 8. Robot Menuju Tray 4 (`IN_PROGRESS`, 85%)
```bash
mosquitto_pub -h $BROKER_IP -t "gh01/agent/mission/status" -m "{\"m_id\":\"$M_ID\",\"r_id\":\"RB01\",\"st\":\"IN_PROGRESS\",\"cur_tray\":4,\"pct\":85,\"bat\":89,\"ts\":$(date +%s)}"
```
*Status UI: Tray aktif = Tray 4, Progress = 85%.*

---

### 9. Kirim Hasil Deteksi Tray 4 (`BAGUS`)
```bash
mosquitto_pub -h $BROKER_IP -t "gh01/agent/mission/result" -m "{\"m_id\":\"$M_ID\",\"r_id\":\"RB01\",\"t_idx\":4,\"status\":\"BAGUS\",\"healthy\":23,\"unhealthy\":2,\"empty\":0,\"pest\":0,\"conf\":0.95,\"ts\":$(date +%s)}"
```
*Status UI: Tray 4 terisi (23 sehat).*

---

### 10. Robot Menyelesaikan Seluruh Misi (`COMPLETED`, 100%)
```bash
mosquitto_pub -h $BROKER_IP -t "gh01/agent/mission/status" -m "{\"m_id\":\"$M_ID\",\"r_id\":\"RB01\",\"st\":\"COMPLETED\",\"cur_tray\":null,\"pct\":100,\"bat\":87,\"ts\":$(date +%s)}"
```
*Status UI: Status misi berubah menjadi COMPLETED / Selesai (Progress 100%).*
