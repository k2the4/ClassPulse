'use client';
import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { StudentRosterUpload } from './student-roster-upload';

type Props = { terms:any[]; classes:any[]; subjects:any[]; teachers:any[] };
export function AdminForms({terms,classes,subjects,teachers}:Props) {
  const [message,setMessage]=useState(''); const [step,setStep]=useState(1);
  async function save(table:string, form:HTMLFormElement, next:number) {
    const values=Object.fromEntries(new FormData(form));
    const payload=table==='teacher_assignments'?{...values,subject_id:values.subject_id||null}:values;
    const {error}=await createClient().from(table).insert(payload);
    if(error) { setMessage(error.message); return; }
    form.reset(); setMessage('Saved. The page will refresh now.'); setStep(next); window.setTimeout(()=>location.reload(),700);
  }
  const submit=(table:string,next:number)=>(event:FormEvent<HTMLFormElement>)=>{event.preventDefault(); void save(table,event.currentTarget,next)};
  return <div className="max-w-3xl space-y-5">
    <div className="rounded-lg bg-sky-50 p-4 text-sm text-slate-700"><b>Simple setup order:</b> 1. Current semester → 2. Subject → 3. Student group → 4. Students. You can skip teacher assignment for now because you are already the administrator.</div>
    {message&&<p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}
    <section className="card"><h2 className="text-lg font-semibold">1. Add the current semester</h2><p className="mt-1 text-sm text-slate-600">This is the teaching period, not the four-year batch. Example: academic year <b>2026-2027</b>, semester <b>7</b>.</p><form onSubmit={submit('academic_terms',2)} className="mt-4 grid gap-3 sm:grid-cols-3"><label className="label">Academic year<input name="year" placeholder="2026-2027" required/></label><label className="label">Semester<input name="semester" placeholder="7" required/></label><button className="btn self-end">Save semester</button></form></section>
    {(terms.length>0||step>=2)&&<section className="card"><h2 className="text-lg font-semibold">2. Add a subject</h2><p className="mt-1 text-sm text-slate-600">Example: code <b>ECE 318T</b>, name <b>Artificial Intelligence</b>.</p><form onSubmit={submit('subjects',3)} className="mt-4 grid gap-3 sm:grid-cols-3"><label className="label">Subject code<input name="code" placeholder="ECE 318T" required/></label><label className="label">Subject name<input name="name" placeholder="Artificial Intelligence" required/></label><button className="btn self-end">Save subject</button></form></section>}
    {(subjects.length>0||step>=3)&&<section className="card"><h2 className="text-lg font-semibold">3. Add a student group (class)</h2><p className="mt-1 text-sm text-slate-600">Example: ECE students who joined in 2023, are now in year 4, section A.</p><form onSubmit={submit('classes',4)} className="mt-4 grid gap-3 sm:grid-cols-2"><label className="label">Current semester<select name="academic_term_id" required><option value="">Choose semester</option>{terms.map(t=><option value={t.id} key={t.id}>{t.year} · Semester {t.semester}</option>)}</select></label><label className="label">Branch<input name="branch" placeholder="ECE" required/></label><label className="label">Batch (degree years)<input name="batch" placeholder="2023-2027" required/></label><label className="label">Current BTech year<input name="year" type="number" min="1" max="4" placeholder="4" required/></label><label className="label">Section<input name="section" placeholder="A" required/></label><button className="btn self-end">Save student group</button></form></section>}
    {(classes.length>0||step>=4)&&<section className="card"><h2 className="text-lg font-semibold">4. Link subject and upload students</h2><div className="mt-4 space-y-5"><form onSubmit={submit('class_subjects',5)} className="max-w-md space-y-3"><b>Link subject to student group</b><select name="class_id" required><option value="">Choose student group</option>{classes.map(c=><option value={c.id} key={c.id}>{c.branch} · {c.batch} · {c.section}</option>)}</select><select name="subject_id" required><option value="">Choose subject</option>{subjects.map(s=><option value={s.id} key={s.id}>{s.code} — {s.name}</option>)}</select><button className="btn">Link subject</button></form><StudentRosterUpload classes={classes}/></div></section>}
  </div>
}
