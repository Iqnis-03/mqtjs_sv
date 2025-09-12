import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Checkbox, FormControlLabel,
  /* TextField, */ Button, Stack
} from '@mui/material';
import './MqtLayout.css';

// Local Storage helpers
const STORAGE_KEY = 'mqt-timer-settings';

const saveSettings = (settings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save settings to localStorage:', error);
  }
};

const loadSettings = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.warn('Failed to load settings from localStorage:', error);
    return null;
  }
};

// Helper function for number input handling
/* const createNumberInputHandler = (setter, min = 1, max = 3600, defaultValue = 60) => ({
  onChange: (e) => {
    const value = e.target.value;
    if (value === '') {
      setter('');
    } else {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue)) {
        setter(Math.max(min, Math.min(max, numValue)));
      }
    }
  },
  onBlur: () => {
    setter((current) => {
      if (current === '' || isNaN(current)) {
        return defaultValue;
      }
      return current;
    });
  }
}); */

const MqtSetting = () => {
  const navigate = useNavigate();

  // Load saved settings or use defaults
  const savedSettings = loadSettings() || {};
  const [tabIndex, setTabIndex] = useState(savedSettings.tabIndex || 0); // storage compatibility
  const initialDurationSec = (() => {
    const raw = savedSettings.duration ?? 600; // default 10 minutes in seconds
    if (savedSettings.durationUnit === 'sec') return Math.max(1, raw);
    const fmt = savedSettings.timeFormat || 'mm';
    return Math.max(1, fmt === 'mm:ss' ? raw : raw * 60);
  })();
  const [durationSec, setDurationSec] = useState(initialDurationSec);
  const [limitBreak, setLimitBreak] = useState(savedSettings.limitBreak || false);
  const [autoRestart, setAutoRestart] = useState(savedSettings.autoRestart || false);
  const [countUp, setCountUp] = useState(savedSettings.countUp || false);
  const [disableKeyboard, setDisableKeyboard] = useState(savedSettings.disableKeyboard || false);
  const [redTrigger, setRedTrigger] = useState(savedSettings.redTrigger || 180);
  const [yellowTrigger, setYellowTrigger] = useState(savedSettings.yellowTrigger || 300);
  const [timeFormat, setTimeFormat] = useState(savedSettings.timeFormat || 'mm');
  const [plusMinusStep, setPlusMinusStep] = useState(savedSettings.plusMinusStep || 5);
  const [circleStyle, setCircleStyle] = useState(savedSettings.circleStyle || 'thin');
  const [soundSet, setSoundSet] = useState(savedSettings.soundSet || 1);
  const [warnMode, setWarnMode] = useState(savedSettings.warnMode || '10s');
  const [startSoundEnabled, setStartSoundEnabled] = useState(
    typeof savedSettings.startSoundEnabled === 'boolean' ? savedSettings.startSoundEnabled : true
  );
  const [circleProgress, setCircleProgress] = useState(savedSettings.circleProgress || 'minute');
  const lastSoundSetRef = useRef((savedSettings.soundSet && savedSettings.soundSet !== 0) ? savedSettings.soundSet : 1);
  const [allowClickableTimer, setAllowClickableTimer] = useState(savedSettings.allowClickableTimer || false);
  const [isLongDuration, setIsLongDuration] = useState(savedSettings.isLongDuration || false);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    const settings = {
      tabIndex,
      duration: durationSec,
      limitBreak,
      autoRestart,
      countUp,
      disableKeyboard,
      redTrigger: redTrigger === '' ? 60 : redTrigger,
      yellowTrigger: yellowTrigger === '' ? 300 : yellowTrigger,
      timeFormat,
      plusMinusStep,
      timerStyle: circleStyle,
      soundSet,
      warnMode,
      startSoundEnabled,
      circleProgress,
      allowClickableTimer,
      isLongDuration,
      durationUnit: 'sec'
    };
    saveSettings(settings);
  }, [tabIndex, durationSec, limitBreak, autoRestart, countUp, disableKeyboard, redTrigger, yellowTrigger, timeFormat, plusMinusStep, circleStyle, soundSet, warnMode, startSoundEnabled, circleProgress, allowClickableTimer, isLongDuration]);

  useEffect(() => {
    if (soundSet !== 0) {
      lastSoundSetRef.current = soundSet;
    }
  }, [soundSet]);

  // Helper function to get clean settings values
  const getCleanSettings = () => ({
    tabIndex,
    duration: durationSec,
    limitBreak,
    autoRestart,
    countUp,
    disableKeyboard,
    redTrigger: redTrigger === '' ? 60 : redTrigger,
    yellowTrigger: yellowTrigger === '' ? 300 : yellowTrigger,
    timeFormat,
    plusMinusStep,
    circleStyle,
    soundSet,
    warnMode,
    startSoundEnabled,
    circleProgress,
    allowClickableTimer,
    isLongDuration,
    durationUnit: 'sec'
  });

  const handleStart = () => {
    const settings = getCleanSettings();
    const durationSeconds = durationSec;
    const params = new URLSearchParams({
      duration: durationSeconds,
      autoRestart: settings.autoRestart,
      countUp: settings.countUp,
      disableKeyboard: settings.disableKeyboard,
      redTrigger: settings.redTrigger,
      yellowTrigger: settings.yellowTrigger,
      timeFormat: settings.timeFormat,
      plusMinusStep: settings.plusMinusStep,
      circleStyle: settings.circleStyle,
      timerStyle: settings.circleStyle,
      soundSet: settings.soundSet,
      warnMode: settings.warnMode,
      circleProgress: settings.circleProgress,
      allowClickableTimer: settings.allowClickableTimer,
      startSoundEnabled: settings.startSoundEnabled,
      limitBreak: settings.limitBreak,
      isLongDuration: settings.isLongDuration
    });
    navigate(`/display?${params.toString()}`);
  };

  // SECTION: Timer settings (duration + format + some core toggles)
  const TimerSettings = (
    <Stack spacing={1}>
      <FormControlLabel control={<Checkbox size="small" checked={autoRestart} onChange={() => setAutoRestart(!autoRestart)} />} label="Autorestart" />
      <FormControlLabel control={<Checkbox size="small" checked={countUp} onChange={() => setCountUp(!countUp)} />} label="Count Up (Reverse)" />
      <FormControlLabel control={<Checkbox size="small" checked={circleProgress === 'full'} onChange={(e) => setCircleProgress(e.target.checked ? 'full' : 'minute')} />} label="Total Time Circle Progress" />
      <FormControlLabel control={<Checkbox size="small" checked={limitBreak} onChange={() => setLimitBreak(!limitBreak)} />} label="Go over 120 minute limit" />
    </Stack>
  );

  // SECTION: Functional controls
  const FunctionSettings = (
    <Stack spacing={1}>
      <div className="inline-fields"></div>
      <FormControlLabel control={<Checkbox size="small" checked={allowClickableTimer} onChange={() => setAllowClickableTimer(!allowClickableTimer)} />} label="Enable time setting even when timer is running" />
      <FormControlLabel control={<Checkbox size="small" checked={disableKeyboard} onChange={() => setDisableKeyboard(!disableKeyboard)} />} label="Disable keyboard control" />
      <FormControlLabel control={<Checkbox size="small" checked={timeFormat === 'mm:ss'} onChange={() => setTimeFormat(timeFormat === 'mm:ss' ? 'mm' : 'mm:ss')} />} label="Ability to set seconds" />
      {/* <FormControlLabel control={<Checkbox size="small" checked={isLongDuration} onChange={() => setIsLongDuration(!isLongDuration)} />} label="Always show Extra Digits" /> */}
    </Stack>
  );

  // SOUND preview
  const previewAudioRef = useRef(null);
  const handlePreviewSound = async (previewSet) => {
    try {
      const target = typeof previewSet === 'number' ? previewSet : soundSet;
      if (previewSet === 'warn') {
        const audio = new Audio(`/warn-end-sound.mp3`);
        previewAudioRef.current = audio;
        audio.preload = 'auto';
        audio.volume = 1.0;
        await audio.play();
        return;
      }
      if (target === 0) return;
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current.currentTime = 0;
      }
      const suffix = target === 1 ? '' : target;
      const audio = new Audio(`/end-sound${suffix}.mp3`);
      previewAudioRef.current = audio;
      audio.preload = 'auto';
      audio.volume = 1.0;
      await audio.play();
    } catch (e) {
      console.warn('Sound preview failed:', e);
    }
  };

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current.src = '';
        previewAudioRef.current = null;
      }
    };
  }, []);

  // Reset to defaults and clear saved settings
  const handleReset = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { }
    setTabIndex(0);
    setDurationSec(600);
    setLimitBreak(false);
    setAutoRestart(false);
    setCountUp(false);
    setDisableKeyboard(false);
    setRedTrigger(60);
    setYellowTrigger(300);
    setTimeFormat('mm');
    setPlusMinusStep(5);
    setCircleStyle('thin');
    setSoundSet(1);
    setWarnMode('10s');
    setStartSoundEnabled(true);
    setCircleProgress('minute');
    setAllowClickableTimer(false);
    setIsLongDuration(false);
  };

  //FULLSCREEN
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn(`Error enabling fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div className="mqt-settings-panel mqt-settings-wide">
      <Typography component="h1" className="mqt-settings-title">Settings</Typography>

      <div className="mqt-settings-grid">
        <div>
          <div className="settings-section">
            <h3>Functions</h3>
            {TimerSettings}
          </div>

          <div className="settings-section">
            <h3>Extra Functions</h3>
            {FunctionSettings}
          </div>

          <div className="settings-section">
            <h3>Actions</h3>
            <div className="settings-actions">
              <Button className="btn" variant="contained" size="small" color="success" onClick={handleStart}>Preview</Button>
              <Button className="btn" variant="outlined" size="small" onClick={toggleFullscreen}>Fullscreen</Button>
              <Button className="btn" variant="outlined" size="small" color="error" onClick={handleReset}>Reset</Button>
            </div>
          </div>
        </div>

        <div>
          <div className="settings-section">
            <h3>Timer Style</h3>
            <Stack spacing={1}>
              <FormControlLabel control={<Checkbox size="small" checked={circleStyle === 'thin'} onChange={() => setCircleStyle('thin')} />} label="Thin" />
              <FormControlLabel control={<Checkbox size="small" checked={circleStyle === 'fat'} onChange={() => setCircleStyle('fat')} />} label="Fat" />
              <FormControlLabel control={<Checkbox size="small" checked={circleStyle === 'bw'} onChange={() => setCircleStyle('bw')} />} label="B&W minimalistic" />
            </Stack>
          </div>

          <div className="settings-section">
            <h3>Sounds</h3>
            <FormControlLabel control={<Checkbox size="small" checked={soundSet !== 0} onChange={(e) => setSoundSet(e.target.checked ? (lastSoundSetRef.current || 1) : 0)} />} label="Timeout sound" />
            <Stack spacing={1} className="options-indent">
              <FormControlLabel control={<Checkbox size="small" checked={soundSet === 1} onChange={() => { setSoundSet(1); handlePreviewSound(1); }} disabled={soundSet === 0} />} label="Sound 1" />
              <FormControlLabel control={<Checkbox size="small" checked={soundSet === 2} onChange={() => { setSoundSet(2); handlePreviewSound(2); }} disabled={soundSet === 0} />} label="Sound 2" />
              <FormControlLabel control={<Checkbox size="small" checked={soundSet === 3} onChange={() => { setSoundSet(3); handlePreviewSound(3); }} disabled={soundSet === 0} />} label="Sound 3" />
              <FormControlLabel control={<Checkbox size="small" checked={soundSet === 4} onChange={() => { setSoundSet(4); handlePreviewSound(4); }} disabled={soundSet === 0} />} label="Sound 4" />
              <FormControlLabel control={<Checkbox size="small" checked={soundSet === 5} onChange={() => { setSoundSet(5); handlePreviewSound(5); }} disabled={soundSet === 0} />} label="Sound 5" />
            </Stack>

            <FormControlLabel sx={{ mt: 1 }} control={<Checkbox size="small" checked={warnMode !== 'none'} onChange={(e) => setWarnMode(e.target.checked ? (warnMode === 'none' ? '10s' : warnMode) : 'none')} />} label="Notification sound" />
            <Stack spacing={1} className="options-indent">
              <FormControlLabel control={<Checkbox size="small" checked={warnMode === '10s'} onChange={() => { setWarnMode('10s'); handlePreviewSound('warn'); }} disabled={warnMode === 'none'} />} label="Last 10 seconds" />
              <FormControlLabel control={<Checkbox size="small" checked={warnMode === '1m'} onChange={() => { setWarnMode('1m'); handlePreviewSound('warn'); }} disabled={warnMode === 'none'} />} label="Last 1 minute (once)" />
              <FormControlLabel control={<Checkbox size="small" checked={warnMode === '5m'} onChange={() => { setWarnMode('5m'); handlePreviewSound('warn'); }} disabled={warnMode === 'none'} />} label="Last 5 minutes (once)" />
            </Stack>
            <FormControlLabel control={<Checkbox size="small" checked={startSoundEnabled} onChange={() => setStartSoundEnabled(!startSoundEnabled)} />} label="Enable Start Sound" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MqtSetting;
