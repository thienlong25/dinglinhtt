import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Trash2, Save, UserRound, Hash, Pencil, Sparkles, Database, ListOrdered, Camera, Search, Filter, Copy } from "lucide-react";
import { motion } from "framer-motion";

type ShippingStatus = "chưa đóng hàng" | "đã đóng hàng";
type StatusFilter = "tất cả" | ShippingStatus;
type Entry = { id: string; igName: string; orderNumbers: string[]; createdAt: string; shippingStatus: ShippingStatus; };
type ParseResult = { ok: true; numbers: string[] } | { ok: false; error: string };
const STORAGE_KEY = "ig_manager_entries_v1";

function formatDate(v: string){ try { return new Date(v).toLocaleString("vi-VN"); } catch { return v; } }
function mergeUniqueNumbers(a:string[],b:string[]){ return [...new Set([...a,...b])].sort((x,y)=>Number(x)-Number(y)); }
function normalizeStoredEntries(value: unknown): Entry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const raw = item as Partial<Entry> & { orderNumber?: string };
    const orderNumbers = Array.isArray(raw.orderNumbers) ? raw.orderNumbers.map(String) : raw.orderNumber ? [String(raw.orderNumber)] : [];
    if (!raw.id || !raw.igName || !raw.createdAt || orderNumbers.length === 0) return [];
    return [{ id:String(raw.id), igName:String(raw.igName), orderNumbers, createdAt:String(raw.createdAt), shippingStatus: raw.shippingStatus === "đã đóng hàng" ? "đã đóng hàng" : "chưa đóng hàng" }];
  });
}
function parseOrderNumbers(input: string, existingEntries: Entry[]): ParseResult {
  const parsed = input.trim().split(/\s+/).map((x)=>x.trim()).filter(Boolean);
  if (!parsed.length) return { ok:false, error:"Vui lòng nhập ít nhất một số thứ tự hợp lệ." };
  if (parsed.some((x)=>!/^\d+$/.test(x))) return { ok:false, error:"Số thứ tự chỉ được chứa số và ngăn cách bằng dấu phẩy." };
  const normalized = parsed.map((x)=>String(Number(x)));
  const dupInput = normalized.filter((x,i)=>normalized.indexOf(x)!==i);
  if (dupInput.length) return { ok:false, error:`Các số thứ tự bị trùng trong ô nhập: ${[...new Set(dupInput)].join(", ")}.` };
  const existing = new Set(existingEntries.flatMap((e)=>e.orderNumbers));
  const dupExisting = normalized.filter((x)=>existing.has(x));
  if (dupExisting.length) return { ok:false, error:`Các số ID đã pass: ${[...new Set(dupExisting)].join(", ")}.` };
  return { ok:true, numbers: normalized };
}
function createId(){ return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2,10)}`; }
function legacyCopyText(text:string){ if(typeof document==="undefined") return false; const t=document.createElement("textarea"); t.value=text; t.setAttribute("readonly",""); t.style.position="fixed"; t.style.top="0"; t.style.left="0"; t.style.opacity="0"; document.body.appendChild(t); t.focus(); t.select(); t.setSelectionRange(0,t.value.length); let copied=false; try{ copied=document.execCommand("copy"); }catch{} document.body.removeChild(t); return copied; }
async function copyText(text:string){ if(typeof navigator!=="undefined" && navigator.clipboard?.writeText){ try{ await navigator.clipboard.writeText(text); return true; }catch{ return legacyCopyText(text); } } return legacyCopyText(text); }

export default function App(): React.JSX.Element {
  const [igName, setIgName] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [message, setMessage] = useState("");
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("tất cả");

  useEffect(() => { try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) setEntries(normalizeStoredEntries(JSON.parse(saved))); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch {} }, [entries]);
  useEffect(() => { if(!message) return; const t=window.setTimeout(()=>setMessage(""),2500); return ()=>window.clearTimeout(t); }, [message]);

  const sortedEntries = useMemo(()=>[...entries].sort((a,b)=>Number(a.orderNumbers[0])-Number(b.orderNumbers[0])), [entries]);
  const filteredEntries = useMemo(()=>sortedEntries.filter((entry)=> {
    const keyword = searchQuery.trim().toLowerCase();
    const matchesKeyword = !keyword || entry.igName.toLowerCase().includes(keyword) || entry.orderNumbers.some((n)=>n.includes(keyword));
    const matchesStatus = statusFilter === "tất cả" || entry.shippingStatus === statusFilter;
    return matchesKeyword && matchesStatus;
  }), [sortedEntries, searchQuery, statusFilter]);
  const deleteTargetEntry = useMemo(()=>entries.find((x)=>x.id===deleteTargetId) ?? null, [entries, deleteTargetId]);
  const totalOrderNumbers = useMemo(()=>entries.reduce((t,x)=>t+x.orderNumbers.length,0), [entries]);
  const packedEntriesCount = useMemo(()=>entries.filter((x)=>x.shippingStatus==="đã đóng hàng").length, [entries]);
  const visibleOrderNumbers = useMemo(()=>filteredEntries.reduce((t,x)=>t+x.orderNumbers.length,0), [filteredEntries]);

  const resetForm = () => { setEditingId(null); setIgName(""); setOrderNumber(""); };
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedName = igName.trim();
    if (!trimmedName) return setMessage("Vui lòng nhập tên IG.");
    const normalizedName = trimmedName.toLowerCase();
    const entriesToValidate = editingId ? entries.filter((e)=>e.id!==editingId) : entries.filter((e)=>e.igName.trim().toLowerCase()!==normalizedName);
    const result = parseOrderNumbers(orderNumber, entriesToValidate);
    if (!result.ok) return setMessage(result.error);
    if (editingId) {
      setEntries((prev)=>prev.map((e)=>e.id===editingId ? { ...e, igName: trimmedName, orderNumbers: result.numbers, createdAt:new Date().toISOString() } : e));
      resetForm(); setMessage("Đã cập nhật thành công."); return;
    }
    const existingEntry = entries.find((e)=>e.igName.trim().toLowerCase()===normalizedName);
    if (existingEntry) {
      setEntries((prev)=>prev.map((e)=>e.id===existingEntry.id ? { ...e, orderNumbers: mergeUniqueNumbers(e.orderNumbers, result.numbers), createdAt:new Date().toISOString() } : e));
      setIgName(""); setOrderNumber(""); setMessage("Tên IG đã tồn tại, đã gộp thêm số thứ tự vào dòng hiện có."); return;
    }
    setEntries((prev)=>[...prev, { id:createId(), igName:trimmedName, orderNumbers:result.numbers, createdAt:new Date().toISOString(), shippingStatus:"chưa đóng hàng" }]);
    setIgName(""); setOrderNumber(""); setMessage("Đã lưu thành công.");
  };
  const handleEdit = (id:string) => { const t=entries.find((x)=>x.id===id); if(!t) return; setEditingId(id); setIgName(t.igName); setOrderNumber(t.orderNumbers.join(", ")); setMessage("Đang chỉnh sửa mục đã chọn."); };
  const handleDelete = (id:string) => setDeleteTargetId(id);
  const handleConfirmDelete = () => { if(!deleteTargetId) return; setEntries((prev)=>prev.filter((x)=>x.id!==deleteTargetId)); if(editingId===deleteTargetId) resetForm(); setDeleteTargetId(null); setMessage("Đã xóa mục đã chọn."); };
  const handleToggleShippingStatus = (id:string) => { setEntries((prev)=>prev.map((e)=>e.id===id ? { ...e, shippingStatus:e.shippingStatus==="đã đóng hàng" ? "chưa đóng hàng" : "đã đóng hàng", createdAt:new Date().toISOString() } : e)); setMessage("Đã cập nhật tình trạng đóng hàng."); };
  const handleCopyIgName = async (name:string) => setMessage((await copyText(name)) ? `Đã copy tên IG: ${name}` : "Không thể copy tên IG.");
  const handleClearAll = () => { setEntries([]); resetForm(); setDeleteTargetId(null); setMessage("Đã xóa toàn bộ dữ liệu."); setIsClearDialogOpen(false); };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.14),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} className="mb-6 overflow-hidden rounded-[32px] border border-white/60 bg-white/70 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700"><Sparkles className="h-3.5 w-3.5" /> IG Manager Dashboard</div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Đinh Linh pass đồ</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 md:text-base">Dinglinhtt x ThienLong</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600"><Camera className="h-5 w-5" /></div><div><div className="text-xs font-medium uppercase tracking-wide text-slate-500">Tổng số đơn hàng</div><div className="text-2xl font-bold text-slate-900">{entries.length}</div></div></div></div>
              <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600"><ListOrdered className="h-5 w-5" /></div><div><div className="text-xs font-medium uppercase tracking-wide text-slate-500">Tổng số món đồ đã pass</div><div className="text-2xl font-bold text-slate-900">{totalOrderNumbers}</div></div></div></div>
              <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-2xl bg-amber-50 p-3 text-amber-600"><Database className="h-5 w-5" /></div><div><div className="text-xs font-medium uppercase tracking-wide text-slate-500">Đã đóng hàng</div><div className="text-base font-bold text-slate-900">{packedEntriesCount} đơn</div></div></div></div>
            </div>
          </div>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.35}}>
            <Card className="flex h-[calc(100vh-12rem)] min-h-[720px] flex-col overflow-hidden rounded-[28px] border-white/70 bg-white/80 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="h-2 bg-slate-100" />
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-2xl font-bold text-slate-900"><div className="rounded-2xl bg-indigo-50 p-2.5 text-indigo-600"><Camera className="h-5 w-5" /></div>{editingId ? "Chỉnh sửa IG" : "Thông tin"}</CardTitle>
                <p className="text-sm leading-6 text-slate-500">{editingId ? "Cập nhật tên IG và số ID sau đó bấm nút lưu thay đổi." : "Nhập tên IG và một hoặc nhiều số ID, ngăn cách bằng dấu phẩy."}</p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2.5">
                    <label className="text-sm font-semibold text-slate-700">Tên IG</label>
                    <div className="relative"><UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={igName} onChange={(e)=>setIgName(e.target.value)} placeholder="Nhập tên IG" className="h-12 rounded-2xl border-[#B3EBF2] bg-slate-50 pl-11 text-base shadow-none focus-visible:ring-2 focus-visible:ring-[#B3EBF2]" /></div>
                  </div>
                  <div className="space-y-2.5">
                    <label className="text-sm font-semibold text-slate-700">Số ID</label>
                    <div className="relative"><Hash className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={orderNumber} onChange={(e)=>setOrderNumber(e.target.value)} placeholder="Ví dụ: 1 2 3" inputMode="text" className="h-12 rounded-2xl border-[#B3EBF2] bg-slate-50 pl-11 text-base shadow-none focus-visible:ring-2 focus-visible:ring-[#B3EBF2]" /></div>
                  </div>
                  <div className="flex flex-wrap gap-3 pt-1">
                    <Button type="submit" className="h-12 flex-1 rounded-2xl bg-[#B3EBF2] text-slate-800 shadow-lg shadow-[#B3EBF2]/40 transition hover:bg-[#9fe3ec]"><Save className="mr-2 h-4 w-4" />{editingId ? "Lưu thay đổi" : "Submit"}</Button>
                    {editingId ? <Button type="button" variant="outline" className="h-12 rounded-2xl border-slate-200 bg-white px-5 text-slate-700 hover:bg-slate-50 hover:text-slate-900" onClick={handleCancelEdit}>Hủy sửa</Button> : null}
                    <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
                      <AlertDialogTrigger asChild><Button type="button" variant="outline" className="h-12 rounded-2xl border-slate-200 bg-white px-5 text-slate-700 hover:bg-slate-50 hover:text-slate-900" disabled={entries.length===0}>Xóa hết</Button></AlertDialogTrigger>
                      <AlertDialogContent className="rounded-3xl">
                        <AlertDialogHeader><AlertDialogTitle>Xóa toàn bộ dữ liệu?</AlertDialogTitle><AlertDialogDescription>Hành động này sẽ xóa toàn bộ tên IG và số ID đã lưu trong danh sách.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-2xl border-[#B3EBF2] bg-[#B3EBF2] text-slate-800 hover:bg-[#9fe3ec] hover:text-slate-900">Hủy</AlertDialogCancel>
                          <AlertDialogAction className="rounded-2xl bg-[#B3EBF2] text-slate-800 hover:bg-[#9fe3ec]" onClick={handleClearAll}>Xác nhận xóa</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </form>
                {message ? <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700">{message}</div> : null}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.45}}>
            <Card className="flex h-[calc(100vh-12rem)] min-h-[720px] flex-col overflow-hidden rounded-[28px] border-white/70 bg-white/80 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="h-2 bg-slate-100" />
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><CardTitle className="text-2xl font-bold text-slate-900">Danh sách đơn</CardTitle></div><div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600"><Database className="h-3.5 w-3.5" />{entries.length} mục đã lưu</div></div>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="mb-4 rounded-[24px] border border-white/80 bg-white/95 p-3 shadow-sm backdrop-blur md:p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex w-full flex-col gap-3 md:max-w-xl md:flex-row md:items-center">
                      <div className="relative flex-1"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} placeholder="Tìm theo tên IG hoặc số thứ tự" className="h-12 rounded-2xl border-[#B3EBF2] bg-slate-50 pl-11 text-base shadow-none focus-visible:ring-2 focus-visible:ring-[#B3EBF2]" /></div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button type="button" variant="outline" className="h-12 rounded-2xl border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"><Filter className="mr-2 h-4 w-4" />{statusFilter === "tất cả" ? "Filter: Tất cả" : statusFilter === "chưa đóng hàng" ? "Filter: Chưa đóng hàng" : "Filter: Đã đóng hàng"}</Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 rounded-2xl">
                          <DropdownMenuItem onClick={()=>setStatusFilter("tất cả")}>Tất cả</DropdownMenuItem>
                          <DropdownMenuItem onClick={()=>setStatusFilter("đã đóng hàng")}>Đã đóng hàng</DropdownMenuItem>
                          <DropdownMenuItem onClick={()=>setStatusFilter("chưa đóng hàng")}>Chưa đóng hàng</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm"><ListOrdered className="h-3.5 w-3.5" />Hiển thị {filteredEntries.length} IG · {visibleOrderNumbers} món</div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto pr-2">
                  {sortedEntries.length === 0 ? (
                    <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50/80 p-10 text-center"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm"><Camera className="h-7 w-7" /></div><div className="text-lg font-semibold text-slate-700">Chưa có dữ liệu nào được lưu</div><div className="mt-2 text-sm text-slate-500">Hãy nhập tên IG và số ID ở khung bên trái để bắt đầu.</div></div>
                  ) : filteredEntries.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center"><div className="text-base font-semibold text-slate-700">Không tìm thấy kết quả phù hợp</div><div className="mt-2 text-sm text-slate-500">Hãy thử tìm bằng tên IG khác hoặc một số thứ tự khác.</div></div>
                  ) : (
                    <div className="space-y-4 pb-2">
                      {filteredEntries.map((item, index)=>(
                        <motion.div key={item.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="group rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-start gap-4">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#B3EBF2] bg-[#B3EBF2] text-sm font-bold text-slate-800 shadow-lg shadow-[#B3EBF2]/40">#{index+1}</div>
                              <div className="space-y-3">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-lg font-bold text-slate-900">{item.igName}</span>
                                    <button type="button" onClick={()=>void handleCopyIgName(item.igName)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900" aria-label={`Copy tên IG ${item.igName}`} title="Copy tên IG"><Copy className="h-4 w-4" /></button>
                                    <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">{item.orderNumbers.length} món</span>
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">Cập nhật: {formatDate(item.createdAt)}</div>
                                </div>
                                <div className="flex flex-wrap gap-2">{item.orderNumbers.map((num)=><span key={`${item.id}-${num}`} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-700 shadow-sm">{num}</span>)}</div>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 self-end lg:self-auto">
                              <button type="button" onClick={()=>handleToggleShippingStatus(item.id)} className={`rounded-full px-3 py-2 text-xs font-semibold transition ${item.shippingStatus === "đã đóng hàng" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-amber-100 text-amber-700 hover:bg-amber-200"}`}>{item.shippingStatus === "đã đóng hàng" ? "Đã đóng hàng" : "Chưa đóng hàng"}</button>
                              <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50" onClick={()=>handleEdit(item.id)}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50" onClick={()=>handleDelete(item.id)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <AlertDialog open={deleteTargetId !== null} onOpenChange={(open)=>{ if(!open) setDeleteTargetId(null); }}>
          <AlertDialogContent className="rounded-3xl">
            <AlertDialogHeader><AlertDialogTitle>Xóa mục này?</AlertDialogTitle><AlertDialogDescription>{deleteTargetEntry ? `Bạn có chắc muốn xóa IG ${deleteTargetEntry.igName} khỏi danh sách đã lưu không?` : "Bạn có chắc muốn xóa mục này khỏi danh sách đã lưu không?"}</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-2xl border-[#B3EBF2] bg-[#B3EBF2] text-slate-800 hover:bg-[#9fe3ec] hover:text-slate-900">Hủy</AlertDialogCancel>
              <AlertDialogAction className="rounded-2xl bg-[#B3EBF2] text-slate-800 hover:bg-[#9fe3ec]" onClick={handleConfirmDelete}>Xác nhận xóa</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
