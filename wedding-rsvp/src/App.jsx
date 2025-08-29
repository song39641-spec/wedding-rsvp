import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Download, Plus, Table as TableIcon, Lock, Unlock, RotateCcw } from "lucide-react";

// --------------------
// Config（純 JavaScript）
// --------------------
const ADMIN_CODE = "932457"; // 可自行修改
const ADMIN_LS_KEY = "wedding_rsvp_admin_mode";
const LS_KEY = "wedding_rsvp_entries_v1";

// === Google Sheets 連動設定 ===
// 貼上你在 Apps Script 部署後拿到的 Web App URL，與同一組密鑰
const SHEET_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbz6cKGXRFgDPjFL6Bjvx7Ew1kDVwFnvpps9VIxD30JeQopnYtPTB2W0hxQDJfudF7pOlw/exec"; // 例如: https://script.google.com/macros/s/AKfycb.../exec
const SHEET_SECRET = "AKfycbz6cKGXRFgDPjFL6Bjvx7Ew1kDVwFnvpps9VIxD30JeQopnYtPTB2W0hxQDJfudF7pOlw";     // 與 Apps Script 裡的 SECRET 一致

const DEFAULT_FORM = {
  name: "",
  side: "groom", // groom | bride
  attending: "yes", // yes | no | maybe
  total: 1,
  mealPref: "meat", // meat | veg | mixed
  meatCount: 1,
  vegCount: 0,
  phone: "",
  notes: "",
};

// --------------------
// Helpers
// --------------------
function toInt(v, d = 0) {
  const n = parseInt(String(v).replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : d;
}

function mealCountsValid(attending, mealPref, total, meatCount, vegCount) {
  if (attending !== "yes") return true; // 只有出席時檢查
  if (mealPref === "mixed") return toInt(meatCount) + toInt(vegCount) === toInt(total);
  if (mealPref === "meat") return toInt(meatCount) === toInt(total) && toInt(vegCount) === 0;
  if (mealPref === "veg") return toInt(vegCount) === toInt(total) && toInt(meatCount) === 0;
  return true;
}

function loadEntries() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(LS_KEY, JSON.stringify(entries));
}

function toCSV(rows) {
  const headers = [
    "時間",
    "姓名",
    "男方/女方",
    "是否出席",
    "人數",
    "餐點偏好",
    "葷食份數",
    "素食份數",
    "電話",
    "備註",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    const arr = [
      r.createdAt,
      r.name,
      r.side === "groom" ? "男方" : "女方",
      r.attending === "yes" ? "出席" : r.attending === "no" ? "不克出席" : "可能出席",
      r.total,
      r.mealPref === "meat" ? "葷" : r.mealPref === "veg" ? "素" : "混合",
      r.meatCount,
      r.vegCount,
      r.phone,
      String(r.notes || "").replaceAll("\n", " ").replaceAll(",", "、"),
    ];
    lines.push(arr.map((x) => `"${String(x).replaceAll('"', '""')}"`).join(","));
  }
  return lines.join("\n");
}

function download(filename, content) {
  try {
    const bom = "\uFEFF"; // Excel BOM，避免中文亂碼
    const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    // Fallback：某些環境禁用 programmatic download
    const dataUrl = "data:text/csv;charset=utf-8," + encodeURIComponent(content);
    window.open(dataUrl, "_blank");
  }
}

// --------------------
// Main App（純 JS 版）
// --------------------
export default function RSVPApp() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [entries, setEntries] = useState(loadEntries());
  const [editingIndex, setEditingIndex] = useState(null);

  // 管理者顯示/切換
  const [adminMode, setAdminMode] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("admin") === "1") return true;
    return localStorage.getItem(ADMIN_LS_KEY) === "1";
  });
  const [askAdmin, setAskAdmin] = useState(false);
  const [adminCodeInput, setAdminCodeInput] = useState("");

  // 提示/確認狀態
  const [banner, setBanner] = useState(null); // 非阻斷式頂部提示（驗證/錯誤）
  const [confirmIndex, setConfirmIndex] = useState(null); // 刪除確認
  const [successOpen, setSuccessOpen] = useState(false); // 送出成功置中提示
  const [successMsg, setSuccessMsg] = useState("");
  const [lastDeleted, setLastDeleted] = useState(null); // 最近刪除項目

  useEffect(() => { saveEntries(entries); }, [entries]);
  useEffect(() => { localStorage.setItem(ADMIN_LS_KEY, adminMode ? "1" : "0"); }, [adminMode]);

  const summary = useMemo(() => {
    const init = { totalYes: 0, totalNo: 0, totalMaybe: 0, meat: 0, veg: 0, bySide: { groom: 0, bride: 0 } };
    return entries.reduce((acc, r) => {
      if (r.attending === "yes") acc.totalYes += r.total;
      if (r.attending === "no") acc.totalNo += r.total;
      if (r.attending === "maybe") acc.totalMaybe += r.total;
      acc.meat += r.meatCount;
      acc.veg += r.vegCount;
      acc.bySide[r.side] += r.total;
      return acc;
    }, init);
  }, [entries]);

  const validMealCounts = useMemo(() => mealCountsValid(
    form.attending, form.mealPref, toInt(form.total, 0), toInt(form.meatCount, 0), toInt(form.vegCount, 0)
  ), [form]);

  function resetForm() {
    setForm(DEFAULT_FORM);
    setEditingIndex(null);
  }

  function toast(msg) {
    setBanner(msg);
    setTimeout(() => setBanner(null), 3000);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      ...form,
      total: toInt(form.total, 0),
      meatCount: toInt(form.meatCount, 0),
      vegCount: toInt(form.vegCount, 0),
      createdAt: new Date().toLocaleString(),
    };
    if (!String(payload.name).trim()) { toast("請填寫姓名"); return; }

    if (payload.attending === "yes") {
      if (payload.total <= 0) { toast("出席人數需大於 0"); return; }
      if (!validMealCounts) { toast("葷/素份數需與總人數一致"); return; }
    } else {
      payload.meatCount = 0; payload.vegCount = 0;
      payload.total = toInt(form.total, 0) || 0;
    }

    // === 送到 Google Sheet（若已設定 URL） ===
    const sendPromise = SHEET_WEBAPP_URL
      ? fetch(SHEET_WEBAPP_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret: SHEET_SECRET, data: payload })
        }).then(async (res) => {
          try {
            const j = await res.json();
            if (!j.ok) throw new Error("sheet not ok");
          } catch (err) {
            throw err;
          }
        })
      : Promise.resolve();

    sendPromise
      .then(() => {
        if (editingIndex !== null) {
          const next = [...entries]; next[editingIndex] = payload; setEntries(next);
        } else {
          setEntries([payload, ...entries]);
        }
        setSuccessMsg("已收到您的回覆，感謝您的寶貴時間");
        setSuccessOpen(true);
        setTimeout(() => setSuccessOpen(false), 2500);
        resetForm();
      })
      .catch(() => {
        toast(SHEET_WEBAPP_URL ? "送出失敗：雲端寫入異常，已暫存本機" : "尚未設定雲端連結，僅保存於本機");
        if (editingIndex !== null) {
          const next = [...entries]; next[editingIndex] = payload; setEntries(next);
        } else {
          setEntries([payload, ...entries]);
        }
        setSuccessMsg("已收到您的回覆（暫存於本機）");
        setSuccessOpen(true);
        setTimeout(() => setSuccessOpen(false), 2500);
        resetForm();
      });
  }

  function handleDelete(idx) { setConfirmIndex(idx); }
  function confirmDeleteNow() {
    if (confirmIndex === null) return;
    const deleted = entries[confirmIndex];
    setEntries(entries.filter((_, i) => i !== confirmIndex));
    setLastDeleted(deleted);
    setConfirmIndex(null);
    toast("已刪除一筆回覆，可點選復原");
  }
  function cancelDeleteNow() { setConfirmIndex(null); }
  function handleUndoDelete() {
    if (lastDeleted) {
      setEntries([lastDeleted, ...entries]);
      setLastDeleted(null);
      toast("已復原刪除的回覆");
    }
  }

  function handleEdit(idx) { setForm({ ...entries[idx] }); setEditingIndex(idx); }
  function handleExport() {
    if (!entries || entries.length === 0) { toast("目前沒有資料可匯出"); return; }
    const csv = toCSV(entries);
    const date = new Date().toISOString().slice(0, 10);
    download(`婚禮RSVP_${date}.csv`, csv);
    toast("已匯出 CSV");
  }

  function handleTotalChange(v) {
    const n = toInt(v, 0);
    if (form.attending === "yes") {
      if (form.mealPref === "meat") { setForm({ ...form, total: n, meatCount: n, vegCount: 0 }); return; }
      if (form.mealPref === "veg") { setForm({ ...form, total: n, meatCount: 0, vegCount: n }); return; }
    }
    setForm({ ...form, total: n });
  }

  function toggleAdmin() {
    if (adminMode) { setAdminMode(false); return; }
    setAskAdmin(true);
  }

  function submitAdminCode(e) {
    if (e) e.preventDefault();
    if (adminCodeInput === ADMIN_CODE) {
      setAdminMode(true);
      setAskAdmin(false);
      setAdminCodeInput("");
    } else {
      toast("代碼錯誤");
    }
  }

  const numberOptions = [...Array(13).keys()].map((n) => ({ label: String(n), value: String(n) }));
  const isAttendingYes = form.attending === "yes";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* 婚禮說明區塊 */}
        <section className="text-center space-y-2">
          <h1 className="text-2xl font-bold">郭松霖 & 李婕妤 婚宴</h1>
          <p className="text-slate-700">誠摯邀請您與我們一同見證愛的承諾</p>
          <p className="italic text-slate-600">Join us as we celebrate the union of our hearts.</p>
          <p className="mt-2">婚禮日期｜2026年3月1號｜星期日</p>
          <p>婚禮地點｜老新台菜｜高雄市三民區十全三路265號燕｜匯Ａ廳</p>
          <div className="h-px w-full bg-slate-200 my-4" />
        </section>

        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">婚禮出席調查（RSVP）</h2>
            <p className="text-slate-600">請親朋好友回覆是否出席、男方/女方、出席人數與餐點（葷/素）。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {adminMode && (
              <>
                <Button onClick={handleExport} className="gap-2" aria-label="匯出CSV"><Download className="h-4 w-4"/> 匯出 CSV</Button>
                {lastDeleted && (
                  <Button onClick={handleUndoDelete} className="gap-2" aria-label="復原刪除"><RotateCcw className="h-4 w-4"/> 復原</Button>
                )}
              </>
            )}
            <Button variant={adminMode ? "secondary" : "outline"} onClick={toggleAdmin} className="gap-2" aria-label="管理者模式">
              {adminMode ? <Unlock className="h-4 w-4"/> : <Lock className="h-4 w-4"/>}
              {adminMode ? "關閉管理者模式" : "管理者模式"}
            </Button>
          </div>
        </header>

        {/* 若尚未設定雲端 WebApp，顯示提醒（只給管理者看）*/}
        {adminMode && !SHEET_WEBAPP_URL && (
          <div className="rounded-md bg-sky-50 border border-sky-200 px-4 py-3 text-sky-800 text-sm">
            尚未設定 Google Sheet WebApp URL，賓客資料將只存於各自裝置本機。請先於 Apps Script 部署 Web App 並把網址與密鑰填入程式常數。
          </div>
        )}

        {/* 若尚未設定雲端 WebApp，顯示提醒（只給管理者看）*/}
        {adminMode && !SHEET_WEBAPP_URL && (
          <div className="rounded-md bg-sky-50 border border-sky-200 px-4 py-3 text-sky-800 text-sm">
            尚未設定 Google Sheet WebApp URL，賓客資料將只存於各自裝置本機。請依照下方說明建立 WebApp 並將網址填入程式內常數。
          </div>
        )}

        {/* 驗證/錯誤提示（頂部非阻斷式） */}
        {banner && (
          <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-amber-800 text-sm">
            {banner}
          </div>
        )}

        {/* 刪除確認（覆蓋層對話框） */}
        {confirmIndex !== null && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
            <Card role="dialog" aria-modal="true" className="w-[92vw] max-w-md shadow-lg">
              <CardHeader>
                <CardTitle className="text-center">確認刪除</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-center">
                  <p>您確認要刪除這筆回覆嗎？此動作無法復原。</p>
                  <div className="rounded-md bg-slate-50 border text-left text-sm p-3">
                    <div><span className="text-slate-500">姓名：</span><b>{entries[confirmIndex]?.name}</b></div>
                    <div><span className="text-slate-500">時間：</span>{entries[confirmIndex]?.createdAt}</div>
                    <div><span className="text-slate-500">人數／餐點：</span>{entries[confirmIndex]?.total} 人 · {entries[confirmIndex]?.mealPref === "meat" ? "葷" : entries[confirmIndex]?.mealPref === "veg" ? "素" : "混合"}</div>
                  </div>
                  <div className="mt-2 flex justify-center gap-3">
                    <Button onClick={confirmDeleteNow} variant="destructive" className="min-w-24">確認刪除</Button>
                    <Button onClick={cancelDeleteNow} variant="secondary" className="min-w-24">取消</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 管理者代碼輸入條（非覆蓋層） */}
        {askAdmin && !adminMode && (
          <Card className="border-amber-300 bg-amber-50/60">
            <CardContent className="flex flex-col gap-3 pt-6 md:flex-row md:items-center md:justify-between">
              <div className="text-sm">
                <p className="font-medium">輸入管理者代碼以顯示回覆列表與統計</p>
                <p className="text-slate-600">只在本機記住，不影響賓客頁面。</p>
              </div>
              <form className="flex items-center gap-2" onSubmit={submitAdminCode}>
                <Input type="password" placeholder="管理者代碼" value={adminCodeInput} onChange={(e) => setAdminCodeInput(e.target.value)} className="w-48" aria-label="管理者代碼" />
                <Button type="submit" className="whitespace-nowrap">啟用管理者模式</Button>
                <Button type="button" variant="ghost" onClick={() => { setAskAdmin(false); setAdminCodeInput(""); }}>取消</Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="form" className="w-full">
          <TabsList className="grid w-full" style={{ gridTemplateColumns: adminMode ? "1fr 1fr" : "1fr" }}>
            <TabsTrigger value="form" className="gap-1"><Plus className="h-4 w-4"/> 回覆表單</TabsTrigger>
            {adminMode && (<TabsTrigger value="list" className="gap-1"><TableIcon className="h-4 w-4"/> 回覆列表與統計</TabsTrigger>)}
          </TabsList>

          {/* 表單分頁 */}
          <TabsContent value="form">
            <Card className="shadow-sm relative">
              <CardHeader><CardTitle>{editingIndex !== null ? "編輯回覆" : "填寫回覆"}</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {/* 姓名 */}
                  <div className="space-y-2">
                    <Label htmlFor="name">姓名 <span className="text-rose-500">*</span></Label>
                    <Input id="name" placeholder="請輸入姓名" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>

                  {/* 聯絡電話 */}
                  <div className="space-y-2">
                    <Label htmlFor="phone">聯絡電話</Label>
                    <Input id="phone" placeholder="可選填" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>

                  {/* 男方/女方 */}
                  <div className="space-y-2">
                    <Label>男方或女方</Label>
                    <RadioGroup value={form.side} onValueChange={(v) => setForm({ ...form, side: v })} className="flex gap-4">
                      <div className="flex items-center space-x-2"><RadioGroupItem value="groom" id="groom" /><Label htmlFor="groom">男方</Label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="bride" id="bride" /><Label htmlFor="bride">女方</Label></div>
                    </RadioGroup>
                  </div>

                  {/* 是否出席 */}
                  <div className="space-y-2">
                    <Label>是否出席</Label>
                    <RadioGroup value={form.attending} onValueChange={(v) => setForm({ ...form, attending: v })} className="flex gap-4">
                      <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id="att-yes" /><Label htmlFor="att-yes">出席</Label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="maybe" id="att-maybe" /><Label htmlFor="att-maybe">可能</Label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="att-no" /><Label htmlFor="att-no">不克前來</Label></div>
                    </RadioGroup>
                  </div>

                  {/* 人數（下拉選單） */}
                  <div className="space-y-2">
                    <Label htmlFor="total">出席人數</Label>
                    <Select value={String(form.total)} onValueChange={handleTotalChange} disabled={form.attending !== "yes" && form.attending !== "maybe"}>
                      <SelectTrigger><SelectValue placeholder="選擇人數" /></SelectTrigger>
                      <SelectContent>
                        {numberOptions.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">若不出席/未定，可選 0 或預估人數。</p>
                  </div>

                  {/* 餐點偏好 */}
                  <div className="space-y-2">
                    <Label>餐點偏好</Label>
                    <Select value={form.mealPref} onValueChange={(v) => {
                      if (v === "meat") setForm({ ...form, mealPref: v, meatCount: form.total, vegCount: 0 });
                      else if (v === "veg") setForm({ ...form, mealPref: v, meatCount: 0, vegCount: form.total });
                      else setForm({ ...form, mealPref: v });
                    }} disabled={!isAttendingYes}>
                      <SelectTrigger><SelectValue placeholder="選擇餐點" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="meat">全部葷食</SelectItem>
                        <SelectItem value="veg">全部素食</SelectItem>
                        <SelectItem value="mixed">葷素都有（請填份數）</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 份數（下拉 0-12；混合時手動） */}
                  <div className={`space-y-2 ${isAttendingYes ? "" : "opacity-50"}`}>
                    <Label>葷/素 份數</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="meatCount" className="text-xs text-slate-500">葷食</Label>
                        <Select value={String(form.meatCount)} onValueChange={(v) => setForm({ ...form, meatCount: toInt(v, 0) })} disabled={!isAttendingYes || form.mealPref !== "mixed"}>
                          <SelectTrigger id="meatCount"><SelectValue placeholder="選擇份數" /></SelectTrigger>
                          <SelectContent>
                            {numberOptions.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="vegCount" className="text-xs text-slate-500">素食</Label>
                        <Select value={String(form.vegCount)} onValueChange={(v) => setForm({ ...form, vegCount: toInt(v, 0) })} disabled={!isAttendingYes || form.mealPref !== "mixed"}>
                          <SelectTrigger id="vegCount"><SelectValue placeholder="選擇份數" /></SelectTrigger>
                          <SelectContent>
                            {numberOptions.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {isAttendingYes && !validMealCounts && (
                      <p className="text-sm text-rose-600">葷食與素食份數加總需等於出席人數（目前為 {toInt(form.meatCount) + toInt(form.vegCount)} / {toInt(form.total)}）。</p>
                    )}
                  </div>

                  {/* 備註 */}
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="notes">備註</Label>
                    <Textarea id="notes" placeholder="例如：攜帶小孩、是否需安排嬰兒椅、過敏食材等" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  </div>

                  {/* 操作 */}
                  <div className="md:col-span-2 flex flex-wrap gap-3">
                    <Button type="submit" className="gap-2"><Plus className="h-4 w-4"/>{editingIndex !== null ? "更新回覆" : "送出回覆"}</Button>
                    {editingIndex !== null && (
                      <Button type="button" variant="secondary" onClick={resetForm} className="gap-2"><X className="h-4 w-4"/> 取消編輯</Button>
                    )}
                  </div>
                </form>
              </CardContent>

              {/* 送出成功：懸浮在表單正中間（可手動關閉，2.5s 自動消失） */}
              {successOpen && (
                <div className="absolute inset-0 z-40 grid place-items-center bg-black/30">
                  <div className="bg-white rounded-xl shadow-lg px-6 py-5 text-center transition-opacity duration-300">
                    <p className="text-base mb-4">{successMsg || "已收到您的回覆，感謝您的寶貴時間"}</p>
                    <Button onClick={() => setSuccessOpen(false)} className="min-w-24">好的</Button>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* 列表分頁（僅管理者顯示） */}
          {adminMode && (
            <TabsContent value="list">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* 統計卡片 */}
                <Card className="shadow-sm">
                  <CardHeader><CardTitle>總覽</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-1 text-sm">
                      <li>確定出席：<b>{summary.totalYes}</b> 人</li>
                      <li>未定/可能：<b>{summary.totalMaybe}</b> 人</li>
                      <li>不克出席：<b>{summary.totalNo}</b> 人</li>
                    </ul>
                    <div className="mt-3 h-px w-full bg-slate-200"/>
                    <ul className="mt-3 space-y-1 text-sm">
                      <li>葷食：<b>{summary.meat}</b> 份</li>
                      <li>素食：<b>{summary.veg}</b> 份</li>
                    </ul>
                    <div className="mt-3 h-px w-full bg-slate-200"/>
                    <ul className="mt-3 space-y-1 text-sm">
                      <li>男方賓客：<b>{summary.bySide.groom}</b> 人</li>
                      <li>女方賓客：<b>{summary.bySide.bride}</b> 人</li>
                    </ul>
                  </CardContent>
                </Card>

                {/* 回覆表格 */}
                <div className="lg:col-span-2">
                  <Card className="shadow-sm">
                    <CardHeader><CardTitle>回覆列表（{entries.length} 筆）</CardTitle></CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 text-left">
                              <th className="p-2">時間</th>
                              <th className="p-2">姓名</th>
                              <th className="p-2">男/女方</th>
                              <th className="p-2">是否出席</th>
                              <th className="p-2">人數</th>
                              <th className="p-2">餐點</th>
                              <th className="p-2">葷</th>
                              <th className="p-2">素</th>
                              <th className="p-2">電話</th>
                              <th className="p-2">備註</th>
                              <th className="p-2">操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entries.length === 0 && (
                              <tr><td colSpan={11} className="p-6 text-center text-slate-500">尚無回覆</td></tr>
                            )}
                            {entries.map((r, idx) => (
                              <tr key={idx} className="border-b hover:bg-slate-50">
                                <td className="p-2 whitespace-nowrap">{r.createdAt}</td>
                                <td className="p-2 whitespace-nowrap">{r.name}</td>
                                <td className="p-2">{r.side === "groom" ? "男方" : "女方"}</td>
                                <td className="p-2">{r.attending === "yes" ? "出席" : r.attending === "no" ? "不克" : "可能"}</td>
                                <td className="p-2">{r.total}</td>
                                <td className="p-2">{r.mealPref === "meat" ? "葷" : r.mealPref === "veg" ? "素" : "混合"}</td>
                                <td className="p-2">{r.meatCount}</td>
                                <td className="p-2">{r.vegCount}</td>
                                <td className="p-2 whitespace-nowrap">{r.phone}</td>
                                <td className="p-2 min-w-[12rem]">{r.notes}</td>
                                <td className="p-2 whitespace-nowrap">
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="secondary" onClick={() => handleEdit(idx)}>編輯</Button>
                                    <Button size="sm" variant="destructive" onClick={() => handleDelete(idx)}>刪除</Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>

        <footer className="text-center text-xs text-slate-500">
          <p>資料僅儲存在您的瀏覽器（LocalStorage）。匯出 CSV 後可分享或彙整到 Excel / Google 試算表。</p>
        </footer>
      </div>
    </div>
  );
}

// --------------------
// Dev/Smoke Tests (non-blocking)
// --------------------
(function runDevTests() {
  try {
    // toInt
    console.assert(toInt("5") === 5, "toInt basic parse failed");
    console.assert(toInt("abc", 7) === 7, "toInt default fallback failed");

    // mealCountsValid 多案例
    console.assert(mealCountsValid("yes", "meat", 3, 3, 0) === true, "meat all valid");
    console.assert(mealCountsValid("yes", "veg", 2, 0, 2) === true, "veg all valid");
    console.assert(mealCountsValid("yes", "mixed", 4, 1, 3) === true, "mixed valid");
    console.assert(mealCountsValid("yes", "mixed", 4, 2, 1) === false, "mixed invalid should be false");
    console.assert(mealCountsValid("no", "meat", 0, 0, 0) === true, "non-attending bypass");

    // CSV 基礎驗證
    const csv = toCSV([
      { createdAt: "2025/08/28 18:00", name: '測試"A"', side: "groom", attending: "yes", total: 2, mealPref: "mixed", meatCount: 1, vegCount: 1, phone: "", notes: "含,逗號\n與換行" },
    ]);
    const lines = csv.split("\n");
    console.assert(lines.length === 2, "CSV should have header + 1 row");
    console.assert(/"測試""A"""/.test(lines[1]), "CSV should escape double quotes");
    console.assert(!/\n/.test(lines[1]), "CSV should replace newlines in notes");
  } catch (err) {
    console.warn("Dev tests warning:", err);
  }
})();
