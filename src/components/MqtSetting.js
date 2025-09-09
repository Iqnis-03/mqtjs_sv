import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Slider, Checkbox, FormControlLabel,
  Select, MenuItem, TextField, Button, FormControl, InputLabel,
  Tabs, Tab, Stack
} from '@mui/material';

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
const createNumberInputHandler = (setter, min = 1, max = 3600, defaultValue = 60) => ({
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
});

const MqtSetting = () => {
  const navigate = useNavigate();

  // Load saved settings or use defaults
  const savedSettings = loadSettings() || {};
  const [tabIndex, setTabIndex] = useState(savedSettings.tabIndex || 0);
  const [duration, setDuration] = useState(savedSettings.duration || 10);
  const [limitBreak, setLimitBreak] = useState(savedSettings.limitBreak || false);
  const [autoRestart, setAutoRestart] = useState(savedSettings.autoRestart || false);
  const [countUp, setCountUp] = useState(savedSettings.countUp || false);
  const [disableKeyboard, setDisableKeyboard] = useState(savedSettings.disableKeyboard || false);
  const [redTrigger, setRedTrigger] = useState(savedSettings.redTrigger || 60);
  const [yellowTrigger, setYellowTrigger] = useState(savedSettings.yellowTrigger || 300);
  const [timeFormat, setTimeFormat] = useState(savedSettings.timeFormat || 'mm');
  const [plusMinusStep, setPlusMinusStep] = useState(savedSettings.plusMinusStep || 5);
  const [theme, setTheme] = useState(savedSettings.theme || 'black');
  const [font, setFont] = useState(savedSettings.font || 'Arial');
  const [circleStyle, setCircleStyle] = useState(savedSettings.circleStyle || 'thin');
  const [soundSet, setSoundSet] = useState(savedSettings.soundSet || 1);
  const [warnMode, setWarnMode] = useState(savedSettings.warnMode || '10s');
  const [hideClockBackground, setHideClockBackground] = useState(savedSettings.hideClockBackground || false);
  const [circleProgress, setCircleProgress] = useState(savedSettings.circleProgress || 'full');
  const [allowClickableTimer, setAllowClickableTimer] = useState(savedSettings.allowClickableTimer || false);

  const handleTabChange = (_, newValue) => setTabIndex(newValue);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    const settings = {
      tabIndex,
      duration,
      limitBreak,
      autoRestart,
      countUp,
      disableKeyboard,
      redTrigger: redTrigger === '' ? 60 : redTrigger,
      yellowTrigger: yellowTrigger === '' ? 300 : yellowTrigger,
      timeFormat,
      plusMinusStep,
      theme,
      font,
      circleStyle,
      soundSet,
      warnMode,
      hideClockBackground,
      circleProgress,
      allowClickableTimer
    };
    saveSettings(settings);
  }, [tabIndex, duration, limitBreak, autoRestart, countUp, disableKeyboard, redTrigger, yellowTrigger, timeFormat, plusMinusStep, theme, font, circleStyle, soundSet, warnMode, hideClockBackground, circleProgress, allowClickableTimer]);

  // Helper function to get clean settings values
  const getCleanSettings = () => ({
    tabIndex,
    duration,
    limitBreak,
    autoRestart,
    countUp,
    disableKeyboard,
    redTrigger: redTrigger === '' ? 60 : redTrigger,
    yellowTrigger: yellowTrigger === '' ? 300 : yellowTrigger,
    timeFormat,
    plusMinusStep,
    theme,
    font,
    circleStyle,
    soundSet,
    warnMode,
    hideClockBackground,
    circleProgress,
    allowClickableTimer
  });

  const handleStart = () => {
    const settings = getCleanSettings();
    const params = new URLSearchParams({
      duration: settings.duration * 60,
      autoRestart: settings.autoRestart,
      countUp: settings.countUp,
      disableKeyboard: settings.disableKeyboard,
      redTrigger: settings.redTrigger,
      yellowTrigger: settings.yellowTrigger,
      timeFormat: settings.timeFormat,
      plusMinusStep: settings.plusMinusStep,
      theme: settings.theme,
      font: settings.font,
      circleStyle: settings.circleStyle,
      soundSet: settings.soundSet,
      warnMode: settings.warnMode,
      hideClockBackground: settings.hideClockBackground,
      circleProgress: settings.circleProgress,
      allowClickableTimer: settings.allowClickableTimer
    });
    navigate(`/display?${params.toString()}`);
  };

  const TimerSettings = (
    <Stack spacing={2}>
      <Typography variant="body2">Duration: {duration} min</Typography>
      <Slider
        size="small"
        min={1}
        max={limitBreak ? 43200 : 120}
        value={duration}
        onChange={(e, v) => setDuration(v)}
      />
      <FormControlLabel control={<Checkbox size="small" checked={autoRestart} onChange={() => setAutoRestart(!autoRestart)} />} label="Auto Restart" />
      <FormControlLabel control={<Checkbox size="small" checked={countUp} onChange={() => setCountUp(!countUp)} />} label="Count Up (Reverse)" />
      <FormControlLabel control={<Checkbox size="small" checked={limitBreak} onChange={() => setLimitBreak(!limitBreak)} />} label="Limit Break (exceed 120 min)" />
    </Stack>
  );

  const FunctionSettings = (
    <Stack spacing={2}>
      <FormControlLabel control={<Checkbox size="small" checked={disableKeyboard} onChange={() => setDisableKeyboard(!disableKeyboard)} />} label="Disable Keyboard Shortcut" />
      <FormControlLabel control={<Checkbox size="small" checked={allowClickableTimer} onChange={() => setAllowClickableTimer(!allowClickableTimer)} />} label="Allow Clickable Timer when running" />
      <FormControlLabel control={<Checkbox size="small" checked={hideClockBackground} onChange={() => setHideClockBackground(!hideClockBackground)} />} label="Hide Clock Background" />
      <FormControl fullWidth size="small">
        <InputLabel>Time Format</InputLabel>
        <Select value={timeFormat} label="Time Format" onChange={(e) => setTimeFormat(e.target.value)}>
          <MenuItem value="mm">MM</MenuItem>
          <MenuItem value="mm:ss">MM:SS</MenuItem>
          {/* <MenuItem value="hh:mm:ss">HH:MM:SS</MenuItem>
          <MenuItem value="hhmmss">HHMMSS (2h5m20s)</MenuItem> */}
        </Select>
      </FormControl>
      <FormControl fullWidth size="small">
        <InputLabel>Circle Bar Progress</InputLabel>
        <Select value={circleProgress} label="Circle Bar Progress" onChange={(e) => setCircleProgress(e.target.value)}>
          <MenuItem value="full">Full Time</MenuItem>
          <MenuItem value="minute">By Minute</MenuItem>
        </Select>
      </FormControl>
      <TextField
        fullWidth
        size="small"
        type="number"
        label="+/- Time Step (seconds)"
        value={plusMinusStep}
        onChange={(e) => setPlusMinusStep(Math.max(1, parseInt(e.target.value) || 1))}
        inputProps={{ min: 1, max: 60 }}
      />
      <TextField
        fullWidth
        size="small"
        type="number"
        label="Red Color Trigger (seconds)"
        value={redTrigger}
        {...createNumberInputHandler(setRedTrigger, 1, 3600, 60)}
        inputProps={{ min: 1, max: 3600 }}
        helperText="Timer turns red when remaining time ≤ this value"
      />
      <TextField
        fullWidth
        size="small"
        type="number"
        label="Yellow Color Trigger (seconds)"
        value={yellowTrigger}
        {...createNumberInputHandler(setYellowTrigger, 1, 3600, 300)}
        inputProps={{ min: 1, max: 3600 }}
        helperText="Timer turns yellow when remaining time ≤ this value"
      />
    </Stack>
  );

  const previewAudioRef = useRef(null);
  const handlePreviewSound = async () => {
    try {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current.currentTime = 0;
      }
      const suffix = soundSet === 1 ? '' : soundSet;
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

  const ExtraFunctionSettings = (
    <Stack spacing={2}>
      <FormControl fullWidth size="small">
        <InputLabel>Background Theme</InputLabel>
        <Select value={theme} label="Background Theme" onChange={(e) => setTheme(e.target.value)}>
          <MenuItem value="black">Default (Black)</MenuItem>
          <MenuItem value="emerald">Dark Blue</MenuItem>
          <MenuItem value="purple">Purple</MenuItem>
          <MenuItem value="green">Green</MenuItem>
          <MenuItem value="white">White</MenuItem>
          <MenuItem value="red">Red</MenuItem>
          <MenuItem value="blue">Blue</MenuItem>
        </Select>
      </FormControl>
      <FormControl fullWidth size="small">
        <InputLabel>Font</InputLabel>
        <Select value={font} label="Font" onChange={(e) => setFont(e.target.value)}>
          <MenuItem value="Arial">Arial</MenuItem>
          <MenuItem value="Times New Roman">Times New Roman</MenuItem>
          <MenuItem value="Mono">Mono</MenuItem>
        </Select>
      </FormControl>
      <FormControl fullWidth size="small">
        <InputLabel>Circle Style</InputLabel>
        <Select value={circleStyle} label="Circle Style" onChange={(e) => setCircleStyle(e.target.value)}>
          <MenuItem value="thin">Thin</MenuItem>
          <MenuItem value="fat">Fat</MenuItem>
          <MenuItem value="bw">B&W Minimalistic</MenuItem>
        </Select>
      </FormControl>
      <Stack direction="row" spacing={1} alignItems="center">
        <FormControl fullWidth size="small">
          <InputLabel>Sound Set</InputLabel>
          <Select value={soundSet} label="Sound Set" onChange={(e) => setSoundSet(parseInt(e.target.value))}>
            <MenuItem value={1}>Set 1</MenuItem>
            <MenuItem value={2}>Set 2</MenuItem>
            <MenuItem value={3}>Set 3</MenuItem>
            <MenuItem value={4}>Set 4</MenuItem>
            <MenuItem value={5}>Set 5</MenuItem>
          </Select>
        </FormControl>
        <Button
          variant="outlined"
          size="small"
          onClick={handlePreviewSound}
          aria-label="Preview selected sound set"
          title="Preview selected sound set"
        >
          <span role="img" aria-label="speaker">🔊</span>
        </Button>
      </Stack>
      <FormControl fullWidth size="small">
        <InputLabel>Notification Sound Mod</InputLabel>
        <Select value={warnMode} label="Notification Sound Mod" onChange={(e) => setWarnMode(e.target.value)}>
          <MenuItem value="10s">Last 10 Seconds</MenuItem>
          <MenuItem value="1m">Last 1 Minute</MenuItem>
          <MenuItem value="5m">Last 5 Minutes</MenuItem>
        </Select>
      </FormControl>
    </Stack>
  );

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
    <Box
      sx={{
        maxWidth: 600,
        margin: '2rem auto',
        background: '#fff',
        borderRadius: '10px',
        padding: '1.5rem',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
      }}
    >
      <Tabs
        value={tabIndex}
        onChange={handleTabChange}
        variant="fullWidth"
        textColor="primary"
        indicatorColor="primary"
        centered
      >
        <Tab label="⏲️ Timer Settings" />
        <Tab label="⚙️ Function" />
        <Tab label="🛠️ Extra Function" />
      </Tabs>

      <Box sx={{ mt: 3 }}>
        {tabIndex === 0 && TimerSettings}
        {tabIndex === 1 && FunctionSettings}
        {tabIndex === 2 && ExtraFunctionSettings}
      </Box>

      <Box sx={{ textAlign: 'center', mt: 4 }}>
        <Button
          variant="contained"
          size="medium"
          color="success"
          onClick={handleStart}
          sx={{ mr: 2 }} // Adds margin-right for spacing
        >
          Preview
        </Button>

        <Button
          variant="outlined"
          onClick={toggleFullscreen}
        >
          Fullscreen
        </Button>
      </Box>
    </Box>
  );
};

export default MqtSetting;
