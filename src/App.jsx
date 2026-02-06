import { useState, useEffect } from 'react';
import './App.css';

const GRID_COLUMNS = [
  { key: 'id', label: 'id' },
  { key: 'pw', label: 'pw' },
  { key: 'birthDate', label: '생년월일' },
  { key: 'phone', label: '전화번호' },
  { key: 'joinPath', label: "가입경로('>'로구분)" },
  { key: 'registeredAt', label: '등록일' },
];

const createEmptyRow = () => ({
  id: '',
  pw: '',
  birthDate: '',
  phone: '',
  joinPath: '',
  registeredAt: '',
});

const normalizeRow = (row = {}) => ({
  id: String(row.id ?? row.ID ?? row.userId ?? '').trim(),
  pw: String(row.pw ?? row.password ?? row.PASSWORD ?? '').trim(),
  birthDate: String(row.birthDate ?? row.birth ?? row['생년월일'] ?? '').trim(),
  phone: String(row.phone ?? row.tel ?? row['전화번호'] ?? '').trim(),
  joinPath: String(row.joinPath ?? row.path ?? row['가입경로'] ?? '').trim(),
  registeredAt: String(row.registeredAt ?? row.regDate ?? row['등록일'] ?? '').trim(),
});

const parseTextRows = (text) => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const parsedRows = lines.map((line) => line.split(delimiter).map((cell) => cell.trim()));

  const headerCandidates = ['id', 'pw', '생년월일', '전화번호', '가입경로', '등록일'];
  const firstRow = parsedRows[0].map((cell) => cell.toLowerCase());
  const hasHeader = headerCandidates.some((header) => firstRow.includes(header.toLowerCase()));

  const dataRows = hasHeader ? parsedRows.slice(1) : parsedRows;

  return dataRows
    .map((cells) => ({
      id: cells[0] ?? '',
      pw: cells[1] ?? '',
      birthDate: cells[2] ?? '',
      phone: cells[3] ?? '',
      joinPath: cells[4] ?? '',
      registeredAt: cells[5] ?? '',
    }))
    .filter((row) => Object.values(row).some((v) => v !== ''));
};

function App() {
  const [rows, setRows] = useState([]);
  const [draftRow, setDraftRow] = useState(createEmptyRow());
  const [status, setStatus] = useState('IDLE');
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    chrome.storage.local.get(['taskQueue', 'currentIndex', 'isProcessing'], (result) => {
      const queue = Array.isArray(result.taskQueue) ? result.taskQueue : [];
      const normalized = queue.map(normalizeRow);

      setRows(normalized);
      setProgress({
        current: result.currentIndex || 0,
        total: normalized.length,
      });

      if (result.isProcessing) {
        setStatus('RUNNING');
      }
    });
  }, []);

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const uploadedRows = parseTextRows(text);

      if (uploadedRows.length === 0) {
        alert('업로드 파일에서 유효한 데이터를 찾지 못했습니다. CSV/TSV 형식을 확인해주세요.');
        return;
      }

      setRows((prev) => [...prev, ...uploadedRows]);
    };

    reader.readAsText(file, 'utf-8');
    event.target.value = '';
  };

  const handleDraftChange = (key, value) => {
    setDraftRow((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddRow = () => {
    if (!draftRow.id || !draftRow.pw) {
      alert('id와 pw는 필수입니다.');
      return;
    }

    setRows((prev) => [...prev, draftRow]);
    setDraftRow(createEmptyRow());
  };

  const handleRemoveRow = (indexToRemove) => {
    setRows((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleStart = () => {
    if (rows.length === 0) {
      alert('업로드 또는 직접 추가로 데이터를 먼저 입력해주세요.');
      return;
    }

    chrome.storage.local.set(
      {
        taskQueue: rows,
        currentIndex: 0,
        isProcessing: true,
      },
      () => {
        setStatus('RUNNING');
        setProgress({ current: 0, total: rows.length });

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'START_BATCH' });
          }
        });
      },
    );
  };

  const handleStop = () => {
    chrome.storage.local.set({ isProcessing: false }, () => {
      setStatus('PAUSED');
    });
  };

  const handleReset = () => {
    chrome.storage.local.clear(() => {
      setRows([]);
      setDraftRow(createEmptyRow());
      setStatus('IDLE');
      setProgress({ current: 0, total: 0 });
    });
  };

  return (
    <div className="container">
      <h1>DOM Automator</h1>

      <div className="input-group">
        <label>엑셀 업로드 (CSV/TSV)</label>
        <input type="file" accept=".csv,.txt,.tsv" onChange={handleFileUpload} />
      </div>

      <div className="input-group">
        <label>행 직접 추가</label>
        <div className="row-form">
          {GRID_COLUMNS.map((column) => (
            <input
              key={column.key}
              type="text"
              value={draftRow[column.key]}
              onChange={(event) => handleDraftChange(column.key, event.target.value)}
              placeholder={column.label}
            />
          ))}
          <button onClick={handleAddRow} className="btn secondary" type="button">
            배열에 추가
          </button>
        </div>
      </div>

      <div className="grid-wrap">
        <table className="data-grid">
          <thead>
            <tr>
              {GRID_COLUMNS.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
              <th>삭제</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={GRID_COLUMNS.length + 1} className="empty-cell">
                  업로드 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={`${row.id}-${row.phone}-${index}`}>
                  {GRID_COLUMNS.map((column) => (
                    <td key={column.key}>{row[column.key]}</td>
                  ))}
                  <td>
                    <button className="delete-btn" onClick={() => handleRemoveRow(index)} type="button">
                      삭제
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="status-bar">
        <span>상태: {status}</span>
        <span>진행: {progress.current} / {progress.total}</span>
        <span>대상 건수: {rows.length}</span>
      </div>

      <div className="button-group">
        {status !== 'RUNNING' ? (
          <button onClick={handleStart} className="btn primary" type="button">
            시작
          </button>
        ) : (
          <button onClick={handleStop} className="btn warning" type="button">
            일시정지
          </button>
        )}
        <button onClick={handleReset} className="btn danger" type="button">
          초기화
        </button>
      </div>
    </div>
  );
}

export default App;
