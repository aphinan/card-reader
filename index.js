const express = require('express');
const { Reader } = require('thaismartcardreader.js');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
const port = process.env.PORT;

const myReader = new Reader();

let personData = null;
let isDeviceConnected = false;

// ตรวจสอบหรือสร้างโฟลเดอร์สำหรับเก็บรูป
const pictureDir = path.join(__dirname, 'picture');
if (!fs.existsSync(pictureDir)) {
    fs.mkdirSync(pictureDir);
}

myReader.on('device-activated', () => {
    console.log('อุปกรณ์ถูกเปิดใช้งาน รอการเสียบบัตร...');
    isDeviceConnected = true;
});

myReader.on('device-deactivated', () => {
    console.log('อุปกรณ์ถูกถอดออก กรุณาเชื่อมต่ออุปกรณ์อีกครั้ง.');
    isDeviceConnected = false;
    personData = null;
});

myReader.on('error', (error) => {
    console.error('เกิดข้อผิดพลาดกับอุปกรณ์:', error);
});

myReader.on('card-inserted', async (person) => {
    console.log('บัตรถูกเสียบแล้ว กำลังอ่านข้อมูลบัตร...');

    try {
        const cid = await person.getCid();
        const nameTH = await person.getNameTH();
        const nameEN = await person.getNameEN();
        const dob = await person.getDoB();
        const issueDate = await person.getIssueDate();
        const expireDate = await person.getExpireDate();
        const address = await person.getAddress();
        const issuer = await person.getIssuer();
        const photo = await person.getPhoto();

        const addressPattern = /(\d+\/\d+)\s*(หมู่ที่\s*(\d+))?\s*(ถนน\s*([ก-๙]+))?\s*(ซ\.\s*[ก-๙]+\s*\d*)?\s*(แยก\s*\d+)?\s*(ตำบล|แขวง)\s*([ก-๙]+)\s*(อำเภอ|เขต)\s*([ก-๙]+)\s*(จังหวัด\s*([ก-๙]+))?/;
        const match = address.match(addressPattern);
        let houseNumber, villageNumber, road, subDistrict, district, province;

        if (match) {
            houseNumber = match[1] ? match[1].trim() : '-'; // บ้านเลขที่
            villageNumber = match[3] ? match[3].trim() : '-'; // หมู่ที่
            road = match[5] ? match[5].trim() : '-'; // ถนน
            subDistrict = match[9] ? match[9].trim() : '-'; // แขวง/ตำบล
            district = match[11] ? match[11].trim() : '-'; // เขต/อำเภอ
            province = match[13] ? match[13].trim() : '-'; // จังหวัด

            personData = {
                cid,
                nameTH,
                nameEN,
                dob,
                issueDate,
                expireDate,
                address: {
                    fullAddress: address,
                    houseNumber,
                    villageNumber,
                    road,
                    subDistrict,
                    district,
                    province
                },
                issuer,
                photo
            };

            console.log(`หมายเลขบัตรประชาชน: ${cid}`);
            console.log(`ชื่อ (ไทย): ${nameTH.prefix} ${nameTH.firstname} ${nameTH.lastname}`);
            console.log(`ชื่อ (อังกฤษ): ${nameEN.prefix} ${nameEN.firstname} ${nameEN.lastname}`);
            console.log(`วันเกิด: ${dob.day}/${dob.month}/${dob.year}`);
            console.log(`ที่อยู่: ${address}`);
            console.log(`บ้านเลขที่: ${houseNumber}`);
            console.log(`หมู่ที่: ${villageNumber}`);
            console.log(`ถนน: ${road}`);
            console.log(`ตำบล/แขวง: ${subDistrict}`);
            console.log(`อำเภอ/เขต: ${district}`);
            console.log(`จังหวัด: ${province}`);
            console.log(`วันที่ออกบัตร: ${issueDate.day}/${issueDate.month}/${issueDate.year}`);
            console.log(`ผู้ออกบัตร: ${issuer}`);
            console.log(`วันหมดอายุ: ${expireDate.day}/${expireDate.month}/${expireDate.year}`);

        } else {
            console.log('ไม่สามารถแยกข้อมูลที่อยู่ได้');
        }

        // // บันทึกรูปภาพในโฟลเดอร์ picture
        // const fileStream = fs.createWriteStream(path.join(pictureDir, `${cid}.bmp`));
        // const photoBuff = Buffer.from(photo);
        // fileStream.write(photoBuff);
        // fileStream.close();
        console.log(`บันทึกภาพที่ ${path.join(pictureDir, `${cid}.bmp`)}`);
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการอ่านบัตร:', error);
    }
});

myReader.on('card-removed', () => {
    console.log('บัตรถูกถอดออก กรุณาเสียบบัตรเพื่อดำเนินการต่อ.');
    personData = null;
});

// สร้าง API endpoint
app.get('/api/person', (req, res) => {
    if (!isDeviceConnected) {
        return res.status(400).json({ message: 'ไม่พบอุปกรณ์!!! กรุณาเชื่อมต่ออุปกรณ์อีกครั้ง.', status: false });
    }

    if (personData) {
        res.json(personData);
    } else {
        res.status(404).json({ message: 'ไม่พบข้อมูล กรุณาเสียบบัตรใหม่.' });
    }
});

// เริ่มเซิร์ฟเวอร์
app.listen(port, '0.0.0.0', () => {
    console.log(`http://localhost:${port}`);
});