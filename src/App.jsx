import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [inputData, setInputData] = useState('');
  const [inputSelector, setInputSelector] = useState('');
  const [targetSelector, setTargetSelector] = useState('');
  const [status, setStatus] = useState('IDLE'); // IDLE, RUNNING, PAUSED
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    // Load saved state on open
    chrome.storage.local.get(['taskQueue', 'currentIndex', 'isProcessing', 'targetSelector', 'inputSelector'], (result) => {
      if (result.taskQueue) {
        setInputData(result.taskQueue.join('\n'));
        setProgress({
          current: result.currentIndex || 0,
          total: result.taskQueue.length
        });
      }
      if (result.targetSelector) setTargetSelector(result.targetSelector);
      if (result.inputSelector) setInputSelector(result.inputSelector);
      if (result.isProcessing) setStatus('RUNNING');
    });
  }, []);

  const handleStart = () => {
    const queue = inputData.split('\n').filter(line => line.trim() !== '');
    if (queue.length === 0) {
      alert('데이터를 입력해주세요.');
      return;
    }
    if (!targetSelector) {
      alert('타켓 버튼 선택자를 입력해주세요.');
      return;
    }

    // Save and Start
    chrome.storage.local.set({
      taskQueue: queue,
      currentIndex: 0,
      isProcessing: true,
      targetSelector,
      inputSelector
    }, () => {
      setStatus('RUNNING');
      setProgress({ current: 0, total: queue.length });

      // Trigger execution in current tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'START_BATCH' });
        }
      });
    });
  };

  const handleStop = () => {
    chrome.storage.local.set({ isProcessing: false }, () => {
      setStatus('PAUSED');
    });
  };

  const handleReset = () => {
    chrome.storage.local.clear(() => {
      setInputData('');
      setInputSelector('');
      setTargetSelector('');
      setStatus('IDLE');
      setProgress({ current: 0, total: 0 });
    });
  };

  return (
    <div className="container">
      <h1>DOM Automator</h1>

      <div className="input-group">
        <label>입력 창 (CSS Selector, 옵션)</label>
        <input
          type="text"
          value={inputSelector}
          onChange={(e) => setInputSelector(e.target.value)}
          placeholder="예: input#username"
        />
      </div>

      <div className="input-group">
        <label>타켓 버튼 (CSS Selector)</label>
        <input
          type="text"
          value={targetSelector}
          onChange={(e) => setTargetSelector(e.target.value)}
          placeholder="예: button#submit, .btn-confirm"
        />
      </div>

      <div className="input-group">
        <label>데이터 목록 (줄바꿈으로 구분)</label>
        <textarea
          value={inputData}
          onChange={(e) => setInputData(e.target.value)}
          placeholder="데이터1&#10;데이터2&#10;데이터3"
          rows={10}
        />
      </div>

      <div className="status-bar">
        <span>상태: {status}</span>
        <span>진행: {progress.current} / {progress.total}</span>
      </div>

      <div className="button-group">
        {status !== 'RUNNING' ? (
          <button onClick={handleStart} className="btn primary">시작</button>
        ) : (
          <button onClick={handleStop} className="btn warning">일시정지</button>
        )}
        <button onClick={handleReset} className="btn danger">초기화</button>
      </div>
    </div>
  );
}

export default App;
