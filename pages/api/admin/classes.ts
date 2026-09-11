import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import { prisma } from "../../../lib/prisma";
import { appendClassRosterStudent, fetchClassRoster } from "../../../lib/googleSheetsRoster";

const isAdmin = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  return !!session?.user && (session.user as any).role === "ADMIN";
};

const text = (value: unknown) => String(value ?? "").trim();

async function teacherExists(id: string) {
  return prisma.user.findFirst({ where: { id, role: "TEACHER" }, select: { id: true } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await isAdmin(req, res))) return res.status(403).json({ error: "Admin access required" });

  try {
    if (req.method === "POST") {
      const {
        action,
        departmentId,
        program,
        academicYear,
        year,
        semester,
        proctorId,
        classId,
        subjectId,
        teacherId,
        sectionId,
        subjectName,
        subjectCode,
        subjectType,
        enrollmentNo,
        studentName,
        studentEmail,
      } = req.body || {};

      if (action === "addTeacher") {
        if (!classId || !teacherId) return res.status(400).json({ error: "Class and teacher are required." });
        const [klass, teacher] = await Promise.all([
          prisma.class.findUnique({ where: { id: String(classId) }, select: { id: true } }),
          teacherExists(String(teacherId)),
        ]);
        if (!klass) return res.status(404).json({ error: "Class not found." });
        if (!teacher) return res.status(404).json({ error: "Teacher not found." });
        await prisma.classAccess.create({ data: { classId: klass.id, teacherId: teacher.id } });
        return res.status(201).json({ ok: true });
      }

      if (action === "addSubject") {
        if (!classId || !sectionId || !text(subjectName) || !text(subjectCode)) {
          return res.status(400).json({ error: "Class, section, subject name and subject code are required." });
        }
        let section = await prisma.section.findUnique({ where: { id: String(sectionId) }, select: { id: true, classId: true } });
        if (!section || section.classId !== String(classId)) return res.status(404).json({ error: "Section does not belong to this class." });
        const created = await prisma.subject.create({
          data: {
            sectionId: section.id,
            name: text(subjectName),
            code: text(subjectCode),
            type: subjectType === "LAB" ? "LAB" : "THEORY",
          },
          select: { id: true },
        });
        return res.status(201).json({ id: created.id });
      }

      if (action === "assignTeacher") {
        if (!classId || !subjectId || !teacherId) return res.status(400).json({ error: "Class, subject and teacher are required." });
        const subject = await prisma.subject.findUnique({ where: { id: String(subjectId) }, select: { id: true, section: { select: { classId: true } } } });
        if (!subject || subject.section.classId !== String(classId)) return res.status(404).json({ error: "Subject does not belong to this class." });
        const teacher = await teacherExists(String(teacherId));
        if (!teacher) return res.status(404).json({ error: "Teacher not found." });
        const existingAssignment = await prisma.assignment.findUnique({ where: { subjectId: subject.id }, select: { teacherId: true } });
        if (existingAssignment) {
          if (existingAssignment.teacherId === teacher.id) return res.status(200).json({ ok: true });
          return res.status(409).json({ error: "This subject already has a teacher. Only one teacher can teach a subject in a class." });
        }
        await prisma.assignment.create({ data: { subjectId: subject.id, teacherId: teacher.id } });
        return res.status(201).json({ ok: true });
      }

      if (action === "addStudent") {
        if (!classId || !sectionId || !text(enrollmentNo) || !text(studentName) || !text(studentEmail)) {
          return res.status(400).json({ error: "Class, section, enrollment number, name and email are required." });
        }
        const section = await prisma.section.findUnique({
          where: { id: String(sectionId) },
          include: { sheetLink: true },
        });
        if (!section || section.classId !== String(classId)) return res.status(404).json({ error: "Section does not belong to this class." });
        if (!section.sheetLink) return res.status(409).json({ error: "No Google Sheet is linked to this section." });

        const roster = await fetchClassRoster(section.sheetLink.sheetId, section.sheetLink.gid);
        if (roster.some((student) => student.enrollmentNo === text(enrollmentNo))) {
          return res.status(409).json({ error: "That enrollment number is already in the Google Sheet." });
        }

        const student = {
          enrollmentNo: text(enrollmentNo),
          name: text(studentName),
          email: text(studentEmail),
        };
        await appendClassRosterStudent(section.sheetLink.sheetId, section.sheetLink.gid, student);
        await prisma.student.upsert({
          where: { sectionId_enrollmentNo: { sectionId: section.id, enrollmentNo: student.enrollmentNo } },
          update: { name: student.name, email: student.email },
          create: { sectionId: section.id, enrollmentNo: student.enrollmentNo, name: student.name, email: student.email },
        });
        return res.status(201).json({ ok: true });
      }

      const cleanProgram = text(program);
      const cleanAcademicYear = text(academicYear);
      const cleanYear = text(year);
      const sem = Number(semester);
      if (!departmentId || !cleanProgram || !cleanAcademicYear || !cleanYear || !Number.isInteger(sem) || sem < 1 || sem > 8) {
        return res.status(400).json({ error: "Department, class name, academic year, year and a valid semester are required." });
      }

      let cleanProctorId: string | null = null;
      if (proctorId) {
        const teacher = await teacherExists(String(proctorId));
        if (!teacher) return res.status(404).json({ error: "Selected proctor is not a teacher." });
        cleanProctorId = teacher.id;
      }

      const created = await prisma.class.create({
        data: {
          departmentId: String(departmentId),
          program: cleanProgram,
          academicYear: cleanAcademicYear,
          year: cleanYear,
          semester: sem,
          proctorId: cleanProctorId,
        },
        select: { id: true },
      });
      return res.status(201).json({ id: created.id });
    }

    const id = text(req.query.id || req.body?.id);
    if (!id) return res.status(400).json({ error: "Class id is required." });

    const existing = await prisma.class.findUnique({ where: { id }, include: { sections: { select: { id: true } }, classAccess: { select: { id: true } } } });
    if (!existing) return res.status(404).json({ error: "Class not found." });

    if (req.method === "PATCH") {
      const { departmentId, program, academicYear, year, semester, proctorId } = req.body || {};
      const cleanProgram = text(program);
      const cleanAcademicYear = text(academicYear);
      const cleanYear = text(year);
      const sem = Number(semester);
      if (!departmentId || !cleanProgram || !cleanAcademicYear || !cleanYear || !Number.isInteger(sem) || sem < 1 || sem > 8) return res.status(400).json({ error: "Department, class name, academic year, year and a valid semester are required." });

      let cleanProctorId: string | null = null;
      if (proctorId) {
        const teacher = await teacherExists(String(proctorId));
        if (!teacher) return res.status(404).json({ error: "Selected proctor is not a teacher." });
        cleanProctorId = teacher.id;
      }

      await prisma.class.update({
        where: { id },
        data: { departmentId: String(departmentId), program: cleanProgram, academicYear: cleanAcademicYear, year: cleanYear, semester: sem, proctorId: cleanProctorId },
      });
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      if (existing.sections.length || existing.classAccess.length) return res.status(409).json({ error: "This class has sections or teacher access records. Remove those relationships before deleting the class." });
      await prisma.class.delete({ where: { id } });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Admin class API error", error);
    if ((error as any)?.code === "P2002") return res.status(409).json({ error: "That record already exists." });
    return res.status(500).json({ error: "The class operation could not be completed." });
  }
}
