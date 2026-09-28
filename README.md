# เงินดี · Personal Finance

เว็บแอปบันทึกรายได้รายเดือน คำนวณภาษีเงินได้บุคคลธรรมดาไทย และมี **AI ที่ปรึกษาการเงิน** ที่ตอบเฉพาะเรื่องการเงิน ภาษี การลงทุน และเศรษฐศาสตร์ ออกแบบให้ข้อมูลส่วนบุคคลปลอดภัยตั้งแต่ต้น และต่อยอดเป็นระบบจัดการพอร์ตการลงทุนได้

## ฟีเจอร์

| หมวด | รายละเอียด |
|---|---|
| **รายได้รายเดือน** | ปฏิทิน 12 เดือน, เงินได้ทุกประเภทตามมาตรา 40(1)–40(8), ภาษีหัก ณ ที่จ่าย, ปุ่ม "คัดลอกไปทุกเดือน", แนะนำอัตราหัก ณ ที่จ่ายอัตโนมัติ |
| **คำนวณภาษี** | อัตราก้าวหน้า, ค่าใช้จ่ายตามประเภทเงินได้, ค่าลดหย่อนครบชุด (ครอบครัว ประกัน PVD/RMF/Thai ESG/กอช. ดอกเบี้ยบ้าน บริจาค 1–2 เท่า), เพดานกลุ่มเกษียณ 500,000, ภาษีวิธีที่ 2 (0.5%), ประมาณการทั้งปีจากข้อมูลที่มี, ยอดชำระเพิ่ม/ได้คืน |
| **ลูกเล่น** | บันไดภาษีแสดงว่าอยู่ขั้นไหน, ตารางโอกาสประหยัดภาษี (คำนวณจริงไม่ใช่ประมาณ), เครื่องจำลอง What-if (เงินเดือนขึ้น/ซื้อกองทุนเพิ่ม), คะแนนสุขภาพภาษี, นับถอยหลังวันยื่นภาษี, confetti เมื่อได้เงินคืน, โหมดมืด, โหมดซ่อนตัวเลข (`Alt+P`), คีย์ลัด `Alt+1..6`, รองรับมือถือ |
| **AI ที่ปรึกษา** | Claude API แบบ streaming, ด่านกรองหัวข้อ (ตอบเฉพาะการเงิน), กันการ prompt injection, ลบข้อมูลส่วนบุคคลก่อนส่ง, เลือกได้ว่าจะให้ AI เห็นตัวเลขสรุปภาษีหรือไม่, ไม่บันทึกประวัติแชท, ใช้งานโหมดออฟไลน์ได้เมื่อไม่มี API key |
| **Public API** | API key แยกสิทธิ์ (scope) เรียกใช้จาก n8n / Python / Google Sheets ผ่าน `/api/v1/*` |
| **พอร์ตการลงทุน (Beta)** | โมดูลส่วนขยาย: บันทึกสินทรัพย์ มูลค่า กำไร/ขาดทุน สัดส่วนพอร์ต และส่งสรุปให้ AI วิเคราะห์ได้ |

## การป้องกันข้อมูลส่วนบุคคล

- **เข้ารหัสระดับฟิลด์ (AES-256-GCM) แบบ envelope encryption**: ผู้ใช้แต่ละคนมีกุญแจข้อมูล (DEK) ของตัวเอง ซึ่งถูกห่อด้วย master key อีกชั้น ยอดเงิน ชื่อผู้จ่าย หมายเหตุ ค่าลดหย่อน พอร์ต และโปรไฟล์ ไม่มีข้อมูลใดเก็บเป็นข้อความอ่านได้ ciphertext ผูกกับแถวด้วย AAD จึงสลับข้อมูลข้ามแถวหรือข้ามผู้ใช้ไม่ได้
- **อีเมลเก็บเป็น HMAC** ในฐานข้อมูล และ IP ใน audit log ก็เก็บเป็นแฮช
- **รหัสผ่าน** แฮชด้วย scrypt, ล็อกบัญชี 15 นาทีเมื่อใส่ผิด 5 ครั้ง, จำกัดความถี่การเรียก, เวลาตอบกลับเท่ากันแม้อีเมลไม่มีในระบบ
- **เซสชัน** เป็นคุกกี้ httpOnly + SameSite=Strict (`__Host-` + Secure เมื่อรันใน production), โทเค็นเก็บเป็นแฮช, หมดอายุเมื่อไม่ใช้งาน 30 นาที, ตรวจ CSRF header, ออกจากระบบทุกอุปกรณ์ได้
- **HTTP hardening**: Helmet + CSP แบบเข้มงวด, `Cache-Control: no-store` สำหรับทุก API, จำกัดขนาด body, ตรวจ input ทุกจุดด้วย zod
- **AI**: ลบเลขบัตรประชาชน (ตรวจ checksum), บัตรเครดิต (Luhn), เบอร์โทร, อีเมล, เลขบัญชี และพาสปอร์ต ก่อนส่ง, ส่งเฉพาะตัวเลขสรุปที่ไม่ระบุตัวตน, ระบบปิดตัวเอง (fail closed) เมื่อด่านกรองหัวข้อใช้งานไม่ได้
- **สิทธิ์ตาม PDPA**: ดาวน์โหลดข้อมูลทั้งหมด (JSON), ลบบัญชีถาวร (ลบ DEK ด้วย ทำให้ข้อมูลใน backup ถอดรหัสไม่ได้), ดูประวัติการใช้งานของตัวเองได้
- **หน้าจอ**: เบลอทั้งแอปอัตโนมัติเมื่อไม่ใช้งาน 5 นาที และมีโหมดซ่อนตัวเลข

## เริ่มใช้งาน

ต้องใช้ Node.js 22.13 ขึ้นไป (ใช้ `node:sqlite` ในตัว จึงไม่มี native dependency)

```bash
npm run setup            # ติดตั้ง dependencies ของ server และ client
cp .env.example .env     # ใส่ ANTHROPIC_API_KEY เพื่อเปิด AI (ถ้าไม่ใส่จะเป็นโหมดออฟไลน์)

# โหมดพัฒนา (2 terminal)
npm run dev:server       # API → http://localhost:8787
npm run dev:client       # UI  → http://localhost:5173

# โหมด production (server เสิร์ฟ UI ที่ build แล้ว)
npm run build && NODE_ENV=production APP_ENCRYPTION_KEY=... npm start

npm test                 # unit + integration tests
```

## Public API (`/api/v1`)

สร้าง API key ได้ที่ **ตั้งค่า & ความปลอดภัย** แล้วส่งใน header `Authorization: Bearer pfk_...`

| Method | Path | Scope | ใช้ทำอะไร |
|---|---|---|---|
| POST | `/api/v1/tax/calculate` | `tax:calculate` | คำนวณภาษีจากข้อมูลที่ส่งไป (ไม่บันทึก) |
| GET | `/api/v1/income/:year` | `income:read` | รายการรายได้ของปี |
| GET | `/api/v1/summary/:year` | `income:read` | สรุปภาษีจริงและประมาณการ + คำแนะนำ |
| POST | `/api/v1/income` | `income:write` | เพิ่มรายได้ (เช่น ดึงอัตโนมัติจาก workflow) |
| POST | `/api/v1/advisor/chat` | `advisor:chat` | ถาม AI (SSE หรือ `"stream": false` สำหรับ JSON) |
| GET | `/api/v1/modules/portfolio/holdings` | `portfolio:read` | พอร์ตการลงทุน |

```bash
curl -X POST http://localhost:8787/api/v1/advisor/chat \
  -H "Authorization: Bearer pfk_xxx" -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"ควรซื้อ Thai ESG เท่าไหร่"}],"stream":false,"shareContext":true}'
```

## โครงสร้างโปรเจกต์

```
server/src
├── tax/rules.js          ตัวเลขกฎหมายภาษีแยกตามปี (ปีใหม่ = แก้ข้อมูล ไม่ต้องแก้โค้ด)
├── tax/calculator.js     เครื่องคำนวณภาษี + คำแนะนำประหยัดภาษี + ประมาณการทั้งปี
├── services/advisor.js   AI: ด่านกรองหัวข้อ + streaming + โหมดออฟไลน์
├── services/pii.js       ตัวลบข้อมูลส่วนบุคคล + ตรวจ prompt injection
├── services/crypto.js    envelope encryption, scrypt
├── modules/              ระบบส่วนขยาย (plugin)
│   ├── index.js          registry
│   ├── store.js          ที่เก็บข้อมูลเข้ารหัสสำหรับทุกโมดูล (ไม่ต้อง migrate schema)
│   └── portfolio/        โมดูลพอร์ตการลงทุน + สัญญา PriceProvider สำหรับดึงราคาอัตโนมัติ
└── routes/               auth, finance, advisor, account (PDPA/API key), publicApi (v1)
client/src                React + Vite + Recharts
```

### เพิ่มโมดูลใหม่ (เช่น จัดการหนี้ / งบประมาณ)

1. สร้าง `server/src/modules/<id>/index.js` ที่ export object ตาม `FinanceModule` (ดู `modules/index.js`)
2. เพิ่มเข้า `MODULES` ใน registry

ทุกโมดูลได้ที่เก็บข้อมูลแบบเข้ารหัส, route `/api/modules/<id>`, route API key `/api/v1/modules/<id>`, scope ของตัวเอง, ส่ง context ให้ AI และถูกรวมใน data export โดยอัตโนมัติ

แผนต่อยอดพอร์ต: implement `PriceProvider` (`modules/portfolio/priceProviders.js`) สำหรับ SET / โบรกเกอร์ / exchange, ติดตามยอด RMF/Thai ESG เทียบกับสิทธิลดหย่อน, rebalance ตามสัดส่วนเป้าหมาย, คำนวณเงินปันผลเข้าหน้ารายได้อัตโนมัติ

## ข้อควรทราบ

ตัวเลขภาษีใน `server/src/tax/rules.js` ควรตรวจกับประกาศกรมสรรพากรทุกปีก่อนยื่นจริง (เช่น เพดานประกันสังคมปี 2569 และมาตรการกระตุ้นเศรษฐกิจที่ประกาศเป็นรายปี) แอปนี้เป็นเครื่องมือช่วยวางแผน ไม่ใช่คำแนะนำทางภาษีหรือการลงทุนอย่างเป็นทางการ
