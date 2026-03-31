import { useEffect, useMemo, useState } from 'react';

type ShippingStatus = 'chưa đóng hàng' | 'đã đóng hàng';
type StatusFilter = 'tất cả' | ShippingStatus;

type Entry = {
  id: string;
  igName: string;
  orderNumbers: string[];
  shippingStatus: ShippingStatus;
  updatedAt: string;
};

type ParseResult =
  | { ok: true; numbers: string[] }
  | { ok: false; error: string };

const STORAGE_KEY = 'dinh_linh_pass_do_entries_v1';

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString('vi-VN');
  } catch {
    return value;
  }
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeEntries(value: unknown): Entry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: Entry[] = [];

  value.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return;
    }

    const raw = item as Partial<Entry> & { orderNumber?: string };
    const orderNumbers = Array.isArray(raw.orderNumbers)
      ? raw.orderNumbers.map((num) => String(num))
      : raw.orderNumber
        ? [String(raw.orderNumber)]
        : [];

    if (!raw.id || !raw.igName || orderNumbers.length === 0 || !raw.updatedAt) {
      return;
    }

    normalized.push({
      id: String(raw.id),
      igName: String(raw.igName),
      orderNumbers,
      shippingStatus: raw.shippingStatus === 'đã đóng hàng' ? 'đã đóng hàng' : 'chưa đóng hàng',
      updatedAt: String(raw.updatedAt),
    });
  });

  return normalized;
}

function mergeUniqueNumbers(currentNumbers: string[], newNumbers: string[]): string[] {
  return [...new Set([...currentNumbers, ...newNumbers])].sort((a, b) => Number(a) - Number(b));
}

function parseOrderNumbers(input: string, existingEntries: Entry[]): ParseResult {
  const rawInput = input.trim();

  if (!rawInput) {
    return { ok: false, error: 'Vui lòng nhập ít nhất một số ID.' };
  }

  const parts = rawInput
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return { ok: false, error: 'Vui lòng nhập ít nhất một số ID hợp lệ.' };
  }

  const hasInvalidNumber = parts.some((item) => !/^\d+$/.test(item));
  if (hasInvalidNumber) {
    return { ok: false, error: 'Số ID chỉ được chứa số và ngăn cách bằng dấu phẩy.' };
  }

  const normalizedNumbers = parts.map((item) => String(Number(item)));
  const duplicateInInput = normalizedNumbers.filter(
    (item, index) => normalizedNumbers.indexOf(item) !== index,
  );

  if (duplicateInInput.length > 0) {
    return {
      ok: false,
      error: `Các số ID bị trùng trong ô nhập: ${[...new Set(duplicateInInput)].join(', ')}.`,
    };
  }

  const existingNumbers = new Set(existingEntries.flatMap((entry) => entry.orderNumbers));
  const duplicateExisting = normalizedNumbers.filter((item) => existingNumbers.has(item));

  if (duplicateExisting.length > 0) {
    return {
      ok: false,
      error: `Các số ID đã tồn tại: ${[...new Set(duplicateExisting)].join(', ')}.`,
    };
  }

  return { ok: true, numbers: normalizedNumbers };
}

function runSelfChecks(): void {
  const empty = parseOrderNumbers('', []);
  console.assert(!empty.ok, 'Should reject empty input');

  const valid = parseOrderNumbers('1, 2, 003', []);
  console.assert(valid.ok && valid.numbers.join(',') === '1,2,3', 'Should normalize valid numbers');

  const duplicate = parseOrderNumbers('1,1,2', []);
  console.assert(!duplicate.ok, 'Should reject duplicate numbers in input');

  const exists = parseOrderNumbers('9', [
    {
      id: '1',
      igName: 'long',
      orderNumbers: ['9'],
      shippingStatus: 'chưa đóng hàng',
      updatedAt: new Date().toISOString(),
    },
  ]);
  console.assert(!exists.ok, 'Should reject existing numbers');

  const merged = mergeUniqueNumbers(['1', '2'], ['2', '5']);
  console.assert(merged.join(',') === '1,2,5', 'Should merge unique numbers');

  const legacy = normalizeEntries([
    {
      id: 'abc',
      igName: 'legacy',
      orderNumbers: ['7'],
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ]);
  console.assert(legacy[0].shippingStatus === 'chưa đóng hàng', 'Should default legacy status');
}

runSelfChecks();

export default function App() {
  const [igName, setIgName] = useState('');
  const [orderInput, setOrderInput] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('tất cả');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isClearAllOpen, setIsClearAllOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        return;
      }
      setEntries(normalizeEntries(JSON.parse(saved)));
    } catch (error) {
      console.error('Không thể đọc dữ liệu đã lưu:', error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (error) {
      console.error('Không thể lưu dữ liệu:', error);
    }
  }, [entries]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timer = window.setTimeout(() => setMessage(''), 2500);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    const closeMenus = () => setIsFilterOpen(false);
    window.addEventListener('click', closeMenus);
    return () => window.removeEventListener('click', closeMenus);
  }, []);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => Number(a.orderNumbers[0]) - Number(b.orderNumbers[0]));
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();

    return sortedEntries.filter((entry) => {
      const matchesKeyword =
        !keyword ||
        entry.igName.toLowerCase().includes(keyword) ||
        entry.orderNumbers.some((num) => num.includes(keyword));

      const matchesStatus = statusFilter === 'tất cả' || entry.shippingStatus === statusFilter;
      return matchesKeyword && matchesStatus;
    });
  }, [searchQuery, sortedEntries, statusFilter]);

  const totalOrders = entries.length;
  const totalItemsPassed = entries.reduce((sum, entry) => sum + entry.orderNumbers.length, 0);
  const packedOrders = entries.filter((entry) => entry.shippingStatus === 'đã đóng hàng').length;
  const visibleItems = filteredEntries.reduce((sum, entry) => sum + entry.orderNumbers.length, 0);
  const deleteTarget = entries.find((entry) => entry.id === deleteTargetId) ?? null;

  function resetForm(): void {
    setEditingId(null);
    setIgName('');
    setOrderInput('');
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const trimmedName = igName.trim();
    if (!trimmedName) {
      setMessage('Vui lòng nhập tên IG.');
      return;
    }

    const normalizedName = trimmedName.toLowerCase();
    const entriesToValidate = editingId
      ? entries.filter((entry) => entry.id !== editingId)
      : entries.filter((entry) => entry.igName.trim().toLowerCase() !== normalizedName);

    const parsed = parseOrderNumbers(orderInput, entriesToValidate);
    if (!parsed.ok) {
      setMessage(parsed.error);
      return;
    }

    if (editingId) {
      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === editingId
            ? {
                ...entry,
                igName: trimmedName,
                orderNumbers: parsed.numbers,
                updatedAt: new Date().toISOString(),
              }
            : entry,
        ),
      );
      resetForm();
      setMessage('Đã cập nhật thành công.');
      return;
    }

    const existingEntry = entries.find((entry) => entry.igName.trim().toLowerCase() === normalizedName);

    if (existingEntry) {
      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === existingEntry.id
            ? {
                ...entry,
                orderNumbers: mergeUniqueNumbers(entry.orderNumbers, parsed.numbers),
                updatedAt: new Date().toISOString(),
              }
            : entry,
        ),
      );
      setIgName('');
      setOrderInput('');
      setMessage('Tên IG đã tồn tại, đã gộp thêm số ID vào dòng hiện có.');
      return;
    }

    const newEntry: Entry = {
      id: createId(),
      igName: trimmedName,
      orderNumbers: parsed.numbers,
      shippingStatus: 'chưa đóng hàng',
      updatedAt: new Date().toISOString(),
    };

    setEntries((prev) => [...prev, newEntry]);
    setIgName('');
    setOrderInput('');
    setMessage('Đã lưu thành công.');
  }

  function handleEdit(id: string): void {
    const target = entries.find((entry) => entry.id === id);
    if (!target) {
      return;
    }

    setEditingId(id);
    setIgName(target.igName);
    setOrderInput(target.orderNumbers.join(', '));
    setMessage('Đang chỉnh sửa mục đã chọn.');
  }

  function handleDeleteConfirm(): void {
    if (!deleteTargetId) {
      return;
    }

    setEntries((prev) => prev.filter((entry) => entry.id !== deleteTargetId));
    if (editingId === deleteTargetId) {
      resetForm();
    }
    setDeleteTargetId(null);
    setMessage('Đã xóa mục đã chọn.');
  }

  function handleClearAll(): void {
    setEntries([]);
    resetForm();
    setDeleteTargetId(null);
    setIsClearAllOpen(false);
    setMessage('Đã xóa toàn bộ dữ liệu.');
  }

  function toggleShippingStatus(id: string): void {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              shippingStatus: entry.shippingStatus === 'đã đóng hàng' ? 'chưa đóng hàng' : 'đã đóng hàng',
              updatedAt: new Date().toISOString(),
            }
          : entry,
      ),
    );
    setMessage('Đã cập nhật tình trạng đóng hàng.');
  }

  const filterLabel =
    statusFilter === 'tất cả'
      ? 'Filter: Tất cả'
      : statusFilter === 'đã đóng hàng'
        ? 'Filter: Đã đóng hàng'
        : 'Filter: Chưa đóng hàng';

  return (
    <div className="page-shell">
      <div className="container">
        <section className="hero-card">
          <div>
            <div className="hero-badge">Đinh Linh pass đồ</div>
            <h1>Quản lý thông tin đơn hàng gọn gàng, dễ theo dõi</h1>
            <p>Lưu tên IG, gộp số ID cùng tài khoản, lọc theo trạng thái đóng hàng và tìm kiếm nhanh trong danh sách đơn.</p>
          </div>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-title">Tổng số đơn hàng</div>
              <div className="stat-value">{totalOrders}</div>
            </div>
            <div className="stat-card">
              <div className="stat-title">Tổng số món đồ đã pass</div>
              <div className="stat-value">{totalItemsPassed}</div>
            </div>
            <div className="stat-card">
              <div className="stat-title">Đã đóng hàng</div>
              <div className="stat-value">{packedOrders} đơn</div>
            </div>
          </div>
        </section>

        <div className="content-grid">
          <section className="panel left-panel">
            <div className="panel-topline" />
            <div className="panel-header">
              <h2>{editingId ? 'Chỉnh sửa IG' : 'Thông tin'}</h2>
              <p>
                {editingId
                  ? 'Cập nhật tên IG và số ID, sau đó bấm lưu thay đổi.'
                  : 'Nhập tên IG và một hoặc nhiều số ID, ngăn cách bằng dấu phẩy.'}
              </p>
            </div>

            <form className="form" onSubmit={handleSubmit}>
              <label className="field">
                <span>Tên IG</span>
                <input
                  value={igName}
                  onChange={(e) => setIgName(e.target.value)}
                  placeholder="Nhập tên IG"
                />
              </label>

              <label className="field">
                <span>Số ID</span>
                <input
                  value={orderInput}
                  onChange={(e) => setOrderInput(e.target.value)}
                  placeholder="Ví dụ: 1, 2, 3"
                />
              </label>

              <div className="button-row">
                <button className="btn btn-primary" type="submit">
                  {editingId ? 'Lưu thay đổi' : 'Submit'}
                </button>
                {editingId ? (
                  <button className="btn btn-secondary" type="button" onClick={() => { resetForm(); setMessage('Đã hủy chỉnh sửa.'); }}>
                    Hủy sửa
                  </button>
                ) : null}
                <button className="btn btn-secondary" type="button" onClick={() => setIsClearAllOpen(true)} disabled={entries.length === 0}>
                  Xóa hết
                </button>
              </div>
            </form>

            {message ? <div className="message-box">{message}</div> : null}
          </section>

          <section className="panel right-panel">
            <div className="panel-topline subtle" />
            <div className="panel-header compact-header">
              <div>
                <h2>Danh sách đơn</h2>
              </div>
              <div className="counter-pill">{entries.length} IG</div>
            </div>

            <div className="list-toolbar">
              <div className="search-wrap">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên IG hoặc số ID"
                />
              </div>

              <div className="filter-wrap" onClick={(e) => e.stopPropagation()}>
                <button className="btn btn-secondary filter-button" type="button" onClick={() => setIsFilterOpen((prev) => !prev)}>
                  {filterLabel}
                </button>
                {isFilterOpen ? (
                  <div className="filter-menu">
                    <button type="button" onClick={() => { setStatusFilter('tất cả'); setIsFilterOpen(false); }}>Tất cả</button>
                    <button type="button" onClick={() => { setStatusFilter('đã đóng hàng'); setIsFilterOpen(false); }}>Đã đóng hàng</button>
                    <button type="button" onClick={() => { setStatusFilter('chưa đóng hàng'); setIsFilterOpen(false); }}>Chưa đóng hàng</button>
                  </div>
                ) : null}
              </div>

              <div className="counter-pill small">Hiển thị {filteredEntries.length} IG · {visibleItems} món</div>
            </div>

            <div className="list-scroll-area">
              {entries.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-title">Chưa có dữ liệu nào được lưu</div>
                  <div className="empty-text">Hãy nhập tên IG và số ID ở khung bên trái để bắt đầu.</div>
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-title">Không tìm thấy kết quả phù hợp</div>
                  <div className="empty-text">Hãy thử tìm bằng tên IG khác hoặc một số ID khác.</div>
                </div>
              ) : (
                <div className="entry-list">
                  {filteredEntries.map((entry, index) => (
                    <article className="entry-card" key={entry.id}>
                      <div className="entry-main">
                        <div className="entry-index">#{index + 1}</div>
                        <div className="entry-body">
                          <div className="entry-top">
                            <div className="entry-name">{entry.igName}</div>
                            <div className="item-pill">{entry.orderNumbers.length} món</div>
                          </div>
                          <div className="entry-time">Cập nhật: {formatDate(entry.updatedAt)}</div>
                          <div className="id-badges">
                            {entry.orderNumbers.map((num) => (
                              <span className="id-badge" key={`${entry.id}-${num}`}>
                                {num}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="entry-actions">
                        <button
                          type="button"
                          className={entry.shippingStatus === 'đã đóng hàng' ? 'status-pill packed' : 'status-pill unpacked'}
                          onClick={() => toggleShippingStatus(entry.id)}
                        >
                          {entry.shippingStatus === 'đã đóng hàng' ? 'Đã đóng hàng' : 'Chưa đóng hàng'}
                        </button>
                        <button className="icon-btn" type="button" onClick={() => handleEdit(entry.id)}>
                          Sửa
                        </button>
                        <button className="icon-btn" type="button" onClick={() => setDeleteTargetId(entry.id)}>
                          Xóa
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {deleteTarget ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Xóa mục này?</h3>
            <p>Bạn có chắc muốn xóa IG {deleteTarget.igName} khỏi danh sách đơn không?</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setDeleteTargetId(null)}>
                Hủy
              </button>
              <button className="btn btn-primary" type="button" onClick={handleDeleteConfirm}>
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isClearAllOpen ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Xóa toàn bộ dữ liệu?</h3>
            <p>Hành động này sẽ xóa toàn bộ tên IG và số ID đã lưu trong danh sách.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setIsClearAllOpen(false)}>
                Hủy
              </button>
              <button className="btn btn-primary" type="button" onClick={handleClearAll}>
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
