import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const students = [
  ["5215002823", "Pranay Bhardwaj", "pranay.bhardwaj20090040@gmail.com"],
  ["5315002823", "kunal jotwani", "kunalye80@gmail.com"],
  ["5415002823", "Sanchit Sharma", "sanchitsharma917@gmail.com"],
  ["5515002823", "Sajal Singhal", "specialsajal@gmail.com"],
  ["5615002823", "Khyati Kakkar", "kkakkar5k@gmail.com"],
  ["5715002823", "chetan kumar", "ck769825@gmail.com"],
  ["5815002823", "Manish", "officialmanishsingh03@gmail.com"],
  ["5915002823", "ISHA JHA", "ishujha360@gmail.com"],
  ["6015002823", "Omar Rizwan", "omarrizwan22424@gmail.com"],
  ["6115002823", "ASHISH SHARMA", "ashishsharma23042004@gmail.com"],
  ["6215002823", "Harsh rautela", "HARSH.RAUTELA15@GMAIL.COM"],
  ["6315002823", "SATYAJEET KUMAR", "KUMARSATYAJEETANAND@GMAIL.COM"],
  ["6415002823", "piyush kumar singh", "piyushsingh22617@gmail.com"],
  ["6515002823", "Arpit Singh", "arpitsingh221972@gmail.com"],
  ["6615002823", "Syed Faizaan Ahmad", "Syedashffaizaan1999@gmail.com"],
  ["6715002823", "Abhimanyu", "abhimanyu3704@gmail.com"],
  ["6815002823", "UTTAM KUMAR", "uttamkumar192006@gmail.com"],
  ["6915002823", "Aastha Raj Singh", "aastharsingh2004@gmail.com"],
  ["7015002823", "Zishan Afzal", "zishanafzal26182@gmail.com"],
  ["7115002823", "Saksham Shaurya", "SAKSHAMSHAURYAEXAM@GMAIL.COM"],
  ["7215002823", "NEERAJ", "neerajbeniwal2015@gmail.com"],
  ["7315002823", "Kartikey Bhardwaj", "kartikeybhardwaj2428@gmail.com"],
  ["7415002823", "Harsh Jindal", "hjinal018@gmail.com"],
  ["7515002823", "Karan Vasisth", "kvasisth2000@gmail.com"],
  ["7615002823", "MANISH KUMAR", "manish0o09955@gmail.com"],
  ["7715002823", "SHIVAM TIWARI", "shivamtiwari020505@gmail.com"],
  ["7815002823", "Ayush Uniyal", "unialayush2@gmail.com"],
  ["7915002823", "Divesh", "keindivesh@gmail.com"],
  ["8015002823", "DAKSH TIWARI", "daksh.tiwari23@gmail.com"],
  ["8215002823", "Rishabh", "rishabh06x@gmail.com"],
  ["8315002823", "Vivek Das", "dasv3125@gmail.com"],
  ["8415002823", "UDIT RATHORE", "uditrathore0602@gmail.com"],
  ["8515002823", "Pranav Mittal", "ppvm.0112@gmail.com"],
  ["8715002823", "Aditya Jha", "adityajha9313@gmail.com"],
  ["8815002823", "kushagra pandey", "kushagrapande302004@gmail.com"],
  ["8915002823", "Rohit", "rk9104593@gmail.com"],
  ["9015002823", "Gaurav kumar", "gouravkm314@gmail.com"],
  ["9115002823", "APARMIT SRIVASTAVA", "aparmitsrivastava1@gmail.com"],
  ["9215002823", "Prashant", "kumarp89180@gmail.com"],
  ["9315002823", "Sarthak Gupta", "sarthakgupta.1105@gmail.com"],
  ["9415002823", "saunak sharma", "saunaksharma@gmail.com"],
  ["9515002823", "Rohan Kumar", "rohan.kumar52003@gmail.com"],
  ["9615002823", "YASHWANT KUMAR BEDIA", "yash613948@gmail.com"],
  ["9715002823", "Khushal", "officialkhushal22@gmail.com"],
  ["9815002823", "Abhi Rana", "Abhirajput25106@gmail.com"],
  ["10015002823", "MOHD SHAHABUDDIN", "mohdshahabuddin039@gmail.com"],
  ["10115002823", "Suraj Kumar", "suraj2004ksmile@gmail.com"],
  ["70115002823", "Radhika Garg", "grgradhika18@gmail.com"],
  ["35215002823", "RAHUL SHARMA", "rahul.0703bkn@gmail.com"],
  ["35315002823", "TANISHA ROSE", "tanisharose91365@gmail.com"],
  ["35415002823", "VINIT MEHLAWAT", "vinitmehlawat07@gmail.com"],
  ["35615002823", "VRINDA DIXIT", "dixitvrinda1704@gmail.com"],
  ["35715002823", "SHINJINI DATTA", "shinjini.005@gmail.com"],
  ["35915002823", "YASHASWINI NARULA", "yashaswininarula@gmail.com"],
  ["75215002823", "Yaksh Verma", "bryant23.yv@gmail.com"],
  ["20115002823", "Abhishek", "ag8882138469@gmail.com"],
  ["20315002823", "Ansh Raj", "anshrajjee3@gmail.com"],
  ["20515002823", "Sneha Juyal", "snehajuyal20@gmail.com"],
  ["20615002823", "Richa", "richabaghel25@gmail.com"],
  ["60915002824", "Raj Gandhi", "rg7065455@gmail.com"],
  ["60215002824", "Gaurav", "gauravkukreja914@gmail.com"],
  ["60815002824", "Sweta Kumari", "swetachandra1212@gmail.com"],
  ["60415002824", "CH Hareesh", "chhareesh11@gmail.com"],
  ["60715002824", "Kunal Kumar", "KKUNAL10169@GMAIL.COM"],
  ["6815002822", "Anant Pratap Singh", "ss4479279@gmail.com"],
] as const;

async function main() {
  const department = await prisma.department.findFirst({
    where: { name: "ECE" },
    orderBy: { createdAt: "asc" },
  });
  if (!department) throw new Error("ECE department not found.");

  const classes = await prisma.class.findMany({
    where: { departmentId: department.id, academicYear: "2026-27", semester: 7 },
    include: { sections: true },
  });

  const cls = classes.find((item) => item.program === "B.Tech ECE 2" && item.sections.some((s) => s.name === "2"))
    ?? classes.find((item) => item.program === "B.Tech ECE 2")
    ?? classes.find((item) => item.program === "B.Tech ECE" && item.sections.some((s) => s.name === "2"));

  if (!cls) throw new Error("ECE 2 Semester 7 class not found.");

  const section = cls.sections.find((item) => item.name === "2") ?? cls.sections.find((item) => item.name === "A");
  if (!section) throw new Error("ECE 2 Semester 7 section not found.");

  for (const [enrollmentNo, name, email] of students) {
    await prisma.student.upsert({
      where: { sectionId_enrollmentNo: { sectionId: section.id, enrollmentNo } },
      update: { name, email },
      create: { sectionId: section.id, enrollmentNo, name, email },
    });
  }

  await prisma.section.update({
    where: { id: section.id },
    data: { strength: students.length },
  });

  console.log(`Seeded ${students.length} students into ${cls.program} Sem 7 Section ${section.name}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
