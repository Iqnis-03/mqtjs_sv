import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './MqtLayout.css';

const FONT_FAMILY = 'Roboto';
const FONT_WEIGHT = 100; // Thin weight

const MqtDisplay = () => {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);

  // Set constant font family and weight
  const effectiveFontFamily = FONT_FAMILY;
  const effectiveFontWeight = FONT_WEIGHT;

  const limitBreak = params.get('limitBreak') === 'true';
  const rawDuration = Math.max(1, parseInt(params.get('duration') || '600', 10) || 600);
  const effectiveMaxSeconds = (limitBreak ? 43200 : 120) * 60;
  const duration = Math.min(rawDuration, effectiveMaxSeconds);
  const autoRestart = params.get('autoRestart') === 'true';
  const countUp = params.get('countUp') === 'true';
  const disableKeyboard = params.get('disableKeyboard') === 'true';
  const redTriggerParam = params.get('redTrigger') || '60';
  const yellowTriggerParam = params.get('yellowTrigger') || '300';

  const redTrigger = Math.max(1, Math.min(3600, parseInt(redTriggerParam, 10) || 60));
  const yellowTrigger = Math.max(1, Math.min(3600, parseInt(yellowTriggerParam, 10) || 300));
  const timeFormat = params.get('timeFormat') || 'mm';
  const plusMinusStep = Math.max(1, parseInt(params.get('plusMinusStep') || '5', 10) || 5);
  const circleStyle = params.get('circleStyle') || 'thin';
  const soundSet = params.get('soundSet') || '1';
  const startSoundEnabled = params.get('startSoundEnabled') !== 'false';
  const warnMode = params.get('warnMode') || '10s';
  const endSoundEnabled = soundSet !== '0';
  const circleProgress = params.get('circleProgress') || 'minute';
  const allowClickableTimer = params.get('allowClickableTimer') === 'true';

  // Using white text for dark theme
  const textColor = '#ffffff';
  const soundSuffix = soundSet === '1' ? '' : soundSet;

  const [time, setTime] = useState(countUp ? 0 : duration);
  const [isRunning, setIsRunning] = useState(false);
  const [currentDuration, setCurrentDuration] = useState(duration);
  const [editingDigit] = useState(null);
  // const [editingDigit, setEditingDigit] = useState(null);
  const [hasEnded, setHasEnded] = useState(false);

  // Smooth progress for continuous animation
  const [smoothTime, setSmoothTime] = useState(countUp ? 0 : duration);
  const lastUpdateTime = useRef(Date.now());
  const animationFrameRef = useRef(null);

  // Helper: seconds currently shown/editable in the display
  const getDisplaySeconds = useCallback(() => {
    const safe = isNaN(time) ? 0 : time;
    return countUp && !isRunning ? currentDuration : Math.max(0, safe);
  }, [countUp, isRunning, currentDuration, time]);

  // Dynamic color based on remaining time
  const getDynamicColor = () => {
    const timeRemaining = countUp ? currentDuration - time : time;

    if (timeRemaining <= redTrigger) {
      return '#ff1744'; // Red
    } else if (timeRemaining <= yellowTrigger) {
      return '#ffc107'; // Yellow
    } else {
      return '#00c853'; // Default green
    }
  };

  const dynamicColor = getDynamicColor();

  // Keep consistent white color for text
  const getDynamicTextColor = () => {
    return textColor; // Always return white
  };

  const dynamicTextColor = getDynamicTextColor();

  // Responsive stroke width helper
  const getResponsiveStrokeWidth = (baseWidth) => {
    const minViewport = Math.min(window.innerWidth, window.innerHeight);

    if (minViewport >= 3840) {
      return baseWidth * 1.5; // Slightly thicker for very large screens
    } else if (minViewport >= 2560) {
      return baseWidth * 1.3;
    } else if (minViewport >= 1440) {
      return baseWidth * 1.1;
    } else {
      return baseWidth;
    }
  };

  const MAX_MINUTES = 43200; // 30 days
  const MAX_MINUTES_EFFECTIVE = limitBreak ? MAX_MINUTES : 120;
  const radius = 110; // Enlarged radius to provide more space for expanding timer text
  const circumference = 2 * Math.PI * radius;

  const circleRef = useRef(null);
  const timeoutRefs = useRef([]);

  // ���� Audio Refs - Multiple instances for instant playback
  const startSoundPath = `/start-sound.mp3`; // Always use Set 1
  const endSoundPath = `/end-sound${soundSuffix}.mp3`; // Uses Sound Set selection
  const warnSoundPath = `/warn-end-sound.mp3`; // Always use Set 1

  // Create multiple instances to avoid conflicts and delays
  const startSounds = useRef([]);
  const endSounds = useRef([]);
  const warnSounds = useRef([]);
  const soundIndexes = useRef({ start: 0, end: 0, warn: 0 });
  const lastWarnSecondRef = useRef(null);
  const audioContextRef = useRef(null);
  const warnOncePlayedRef = useRef(false);

  const ensureAudioContext = useCallback(async () => {
    try {
      if (typeof AudioContext === 'undefined') return;
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
    } catch {
      // Ignore audio context errors
    }
  }, []);

  const playFromPool = useCallback(async (poolRef, key) => {
    const pool = poolRef.current;
    if (!pool || pool.length === 0) return;
    const currentIndex = soundIndexes.current[key] || 0;
    const audio = pool[currentIndex];
    if (!audio) return;
    try {
      await ensureAudioContext();
      audio.currentTime = 0;
      if (audio.readyState >= 2) {
        await audio.play();
      } else {
        audio.addEventListener('canplay', async () => {
          await audio.play();
        }, { once: true });
      }
      soundIndexes.current[key] = (currentIndex + 1) % pool.length;
    } catch (error) {
      console.warn(`${key} sound playback failed:`, error);
      const fallbackIndex = (currentIndex + 1) % pool.length;
      const fallbackAudio = pool[fallbackIndex];
      if (fallbackAudio) {
        try {
          fallbackAudio.currentTime = 0;
          await fallbackAudio.play();
          soundIndexes.current[key] = (fallbackIndex + 1) % pool.length;
        } catch {
          // swallow
        }
      }
    }
  }, [ensureAudioContext]);


  // 🎯 Initialize multiple audio instances for instant playback
  useEffect(() => {
    // Create multiple instances of each sound for cycling (ensure enough for 10 rapid plays)
    for (let i = 0; i < 12; i++) {
      startSounds.current[i] = new Audio(startSoundPath);
      if (endSoundEnabled) {
        endSounds.current[i] = new Audio(endSoundPath);
      }
      warnSounds.current[i] = new Audio(warnSoundPath);
    }

    const allSounds = [
      ...startSounds.current,
      ...(endSoundEnabled ? endSounds.current : []),
      ...warnSounds.current
    ];

    // Enhanced audio preparation for reduced delay
    allSounds.forEach((audio) => {
      audio.preload = 'auto';
      audio.volume = 1.0;
      audio.playbackRate = 1.0;

      try {
        audio.load();

        // Enhanced pre-warming: ensure audio context is ready
        const warmAudio = () => {
          audio.play().then(() => {
            audio.pause();
            audio.currentTime = 0;
          }).catch(() => {
            // If play fails, try again after user interaction
          });
        };

        // Try immediate warm-up
        warmAudio();

        // Add backup warm-up on any user interaction
        const handleUserInteraction = () => {
          warmAudio();
          document.removeEventListener('click', handleUserInteraction);
          document.removeEventListener('keydown', handleUserInteraction);
        };

        document.addEventListener('click', handleUserInteraction, { once: true });
        document.addEventListener('keydown', handleUserInteraction, { once: true });

      } catch (e) {
        console.warn('Failed to load audio file:', e);
      }
    });

    return () => {
      allSounds.forEach(audio => {
        audio.pause();
        audio.src = '';
      });
    };
  }, [startSoundPath, endSoundPath, warnSoundPath, endSoundEnabled]);

  // ▶️ Play start sound when timer actually starts running
  useEffect(() => {
    if (isRunning && startSoundEnabled) {
      playFromPool(startSounds, 'start');
    }
  }, [isRunning, playFromPool, startSoundEnabled]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(prev => {
        if (!isRunning) return prev;

        let nextTime = prev;

        if (countUp) {
          if (prev >= currentDuration) {
            if (autoRestart) return 0;
            setIsRunning(false);
            return currentDuration;
          }
          nextTime = prev + 1;
        } else {
          if (prev <= 0) {
            if (autoRestart) return currentDuration;
            setIsRunning(false);
            return 0;
          }
          nextTime = prev - 1;

          // 🔊 Warn sound trigger
          if (warnMode !== 'none') {
            if (warnMode === '10s') {
              // Beep exactly once per visible second in the last 10 seconds (supports up and down)
              const remaining = countUp ? (currentDuration - nextTime) : nextTime;
              const intRemaining = Math.ceil(remaining);
              if (intRemaining > 0 && intRemaining <= 10) {
                if (lastWarnSecondRef.current !== intRemaining) {
                  lastWarnSecondRef.current = intRemaining;
                  playFromPool(warnSounds, 'warn');
                }
              } else {
                lastWarnSecondRef.current = null;
              }
            } else if (warnMode === '1m') {
              if (!warnOncePlayedRef.current && prev > 60 && nextTime <= 60) {
                warnOncePlayedRef.current = true;
                playFromPool(warnSounds, 'warn');
              }
            } else if (warnMode === '5m') {
              if (!warnOncePlayedRef.current && prev > 300 && nextTime <= 300) {
                warnOncePlayedRef.current = true;
                playFromPool(warnSounds, 'warn');
              }
            }
          }
        }

        return nextTime;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
      timeoutRefs.current = [];
    };
  }, [isRunning, currentDuration, countUp, autoRestart, warnMode, playFromPool]);

  // Smooth progress animation for continuous circle movement
  useEffect(() => {
    const updateSmoothProgress = () => {
      if (!isRunning) {
        // When not running, sync smooth time with actual time
        setSmoothTime(time);
        return;
      }

      const now = Date.now();
      const deltaTime = (now - lastUpdateTime.current) / 1000; // Convert to seconds

      setSmoothTime(prevSmoothTime => {
        let newSmoothTime;

        if (countUp) {
          newSmoothTime = prevSmoothTime + deltaTime;
          // Don't exceed the target duration
          if (newSmoothTime > currentDuration) {
            newSmoothTime = currentDuration;
          }
        } else {
          newSmoothTime = prevSmoothTime - deltaTime;
          // Don't go below zero
          if (newSmoothTime < 0) {
            newSmoothTime = 0;
          }
        }

        return newSmoothTime;
      });

      lastUpdateTime.current = now;

      if (isRunning) {
        animationFrameRef.current = requestAnimationFrame(updateSmoothProgress);
      }
    };

    if (isRunning) {
      lastUpdateTime.current = Date.now();
      animationFrameRef.current = requestAnimationFrame(updateSmoothProgress);
    } else {
      // Sync smooth time with discrete time when stopped
      setSmoothTime(time);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRunning, time, currentDuration, countUp]);

  const endTriggeredRef = useRef(false);

  useEffect(() => {
    if (!isRunning) return;
    if (endTriggeredRef.current) return;

    const thresholdReached = countUp
      ? smoothTime >= currentDuration - 0.01
      : smoothTime <= 0.01;

    if (!thresholdReached) return;

    // Ensure we set hasEnded and play the end sound
    endTriggeredRef.current = true;
    setHasEnded(true);
    setIsRunning(false); // Stop the timer when it ends
    playFromPool(endSounds, 'end');

    if (countUp) {
      if (autoRestart) {
        setTime(0);
        setSmoothTime(0);
        lastUpdateTime.current = Date.now();
        endTriggeredRef.current = false;
        setHasEnded(false);
      } else {
        setIsRunning(false);
        setTime(currentDuration);
        setSmoothTime(currentDuration);
      }
    } else {
      if (autoRestart) {
        setTime(currentDuration);
        setSmoothTime(currentDuration);
        lastUpdateTime.current = Date.now();
        endTriggeredRef.current = false;
        setHasEnded(false);
      } else {
        setIsRunning(false);
        setTime(0);
        setSmoothTime(0);
      }
    }
  }, [isRunning, smoothTime, currentDuration, countUp, autoRestart, playFromPool]);

  useEffect(() => {
    if (isRunning) {
      endTriggeredRef.current = false;
      warnOncePlayedRef.current = false;
      lastWarnSecondRef.current = null;
      setHasEnded(false);
    }
  }, [isRunning, currentDuration]);

  // Circle stroke - add safety checks to prevent NaN
  const safeDuration = currentDuration > 0 ? currentDuration : 1; // Prevent division by zero
  const safeSmoothTime = isNaN(smoothTime) ? (countUp ? 0 : safeDuration) : smoothTime;

  // Calculate progress based on circle progress mode using smooth time for continuous animation
  let percent;

  // Auto-switch to second progress when ≤10 seconds remain (regardless of setting)
  const timeRemaining = countUp ? safeDuration - safeSmoothTime : safeSmoothTime;
  const useSecondProgress = timeRemaining <= 10;

  if (useSecondProgress) {
    // 10-SECOND COUNTDOWN MODE: Circle does one full lap per second
    const smoothTimeRemaining = countUp ? safeDuration - safeSmoothTime : safeSmoothTime;
    if (countUp) {
      // Fractional progress within the current second (0 -> 1 each second)
      percent = safeSmoothTime - Math.floor(safeSmoothTime);
    } else {
      // Fractional progress within the current second while counting down
      // Uses ceil to start at 0 exactly on integer seconds (e.g., 10, 9, ...)
      percent = Math.ceil(smoothTimeRemaining) - smoothTimeRemaining;
    }
  } else if (circleProgress === 'minute') {
    // BY MINUTE MODE: circle shows elapsed seconds within current minute
    const remainingSecondsInMinute = safeSmoothTime % 60;
    if (countUp) {
      // Count up: remainingSecondsInMinute is actually elapsed seconds (0->59)
      percent = remainingSecondsInMinute / 60;
    } else {
      // Count down: calculate elapsed seconds in current minute
      // If timer shows 5:45, we've been in this minute for 15 seconds (60-45=15)
      const elapsedSecondsInMinute = (60 - remainingSecondsInMinute) % 60;
      percent = elapsedSecondsInMinute / 60;
    }
  } else {
    // FULL TIME MODE: circle fills based on total time progress (default)
    percent = countUp ? safeSmoothTime / safeDuration : (safeDuration - safeSmoothTime) / safeDuration;
  }

  const safePercent = isNaN(percent) ? 0 : Math.max(0, Math.min(1, percent)); // Clamp between 0-1
  const strokeDashoffset = hasEnded
    ? circumference // show no progress (empty) so only grey base circle remains
    : (countUp ? circumference * (1 - safePercent) : -circumference * safePercent);

  const baseStrokeWidth = circleStyle === 'fat' ? 16 : circleStyle === 'bw' ? 2 : 8;
  const computedStrokeWidth = getResponsiveStrokeWidth(baseStrokeWidth);

  // Time format
  const formatTime = () => {
    const total = getDisplaySeconds();
    const s = total % 60;
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);

    // Ensure s is a valid number
    const safeS = isNaN(s) ? 0 : s;

    switch (timeFormat) {
      case 'mm':
        // When isLongDuration is true, show hours format
        if (isLongDuration) {
          return `${h}h${String(m).padStart(2, '0')}`;
        }
        // Auto-switch to SS format when <60 seconds to avoid showing "0"
        if (total < 60) {
          return String(safeS); // Show seconds directly (59, 58, 57...)
        }
        // Normal MM format for 60+ seconds (show ceiling minute until boundary)
        return `${String(Math.ceil(total / 60)).padStart(2, '0')}`;
      case 'mm:ss':
        // When isLongDuration is true, show hours format with minutes
        if (isLongDuration) {
          return `${h}h${String(m).padStart(2, '0')}`;
        }
        return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(safeS).padStart(2, '0')}`;
      default:
        return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(safeS).padStart(2, '0')}`;
    }
  };

  // Determine if we should switch to hour-inclusive display when current time exceeds 120 minutes
  const currentTotalSeconds = getDisplaySeconds();
  // Use the URL parameter isLongDuration if provided, otherwise use the default logic
  const forceShowHours = params.get('isLongDuration') === 'true';
  const isLongDuration = forceShowHours || Math.floor(currentTotalSeconds / 60) > 120;
  const isVeryLongDuration = Math.floor(currentTotalSeconds / 60) >= 1440;

  const canEditDigits = allowClickableTimer || !isRunning;

  // Dynamic font size based on actual digit count and screen size
  const getDynamicFontSize = () => {
    const timeText = formatTime();
    const displaySeconds = getDisplaySeconds();
    const textLength = timeText.length;

    // Get viewport dimensions for responsive scaling
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const minViewport = Math.min(viewportWidth, viewportHeight);

    // Base scale factor based on screen size
    let scaleFactor = 1;
    if (minViewport >= 3840) {
      scaleFactor = 4.5; // Ultra large (75-inch+)
    } else if (minViewport >= 2560) {
      scaleFactor = 3.5; // Extra large (4K)
    } else if (minViewport >= 1440) {
      scaleFactor = 2.5; // Large desktop
    } else if (minViewport >= 768) {
      scaleFactor = 1.8; // Medium screens
    }

    // Smart sizing based on actual content for each format
    let baseSize;

    if (timeFormat === 'mm') {
      const totalTime = displaySeconds;

      // Check if we're in SS mode (last minute)
      if (totalTime < 60 && !isLongDuration) {
        // SS mode: showing seconds (1-2 digits)
        const secondsStr = String(Math.floor(totalTime % 60));
        const actualDigits = secondsStr.length;

        if (actualDigits === 1) {
          baseSize = 80; // Single digit seconds
        } else {
          baseSize = 68; // Two digit seconds
        }
      } else if (isLongDuration) {
        // HHMM mode sizing depending on hour digits
        const hours = Math.floor(safeDuration / 3600);
        const hourDigits = String(hours).length || 1;
        if (hourDigits === 1) baseSize = 58; // e.g., 1h00m
        else if (hourDigits === 2) baseSize = 50;
        else if (hourDigits === 3) baseSize = 42;
        else baseSize = 35;
      } else {
        // MM mode: showing minutes (1, 2, 3, 4+ digits)
        const totalMinutes = Math.ceil(totalTime / 60);
        const actualDigits = String(totalMinutes).length;

        if (actualDigits === 1) {
          baseSize = 80; // Single digit gets biggest size
        } else if (actualDigits === 2) {
          baseSize = 68; // Two digits get large size
        } else if (actualDigits === 3) {
          baseSize = 56; // Three digits get medium size
        } else {
          baseSize = 45; // Four+ digits get smaller size
        }
      }
    } else if (timeFormat === 'mm:ss') {
      if (isLongDuration) {
        // HH:MM mode sizing depending on hour digits
        const hours = Math.floor(safeDuration / 3600);
        const hourDigits = String(hours).length || 1;
        if (hourDigits === 1) baseSize = 58; // 1h:00m
        else if (hourDigits === 2) baseSize = 50;
        else if (hourDigits === 3) baseSize = 42;
        else baseSize = 35;
      } else {
        // For MM:SS format, consider minute digits + colon + seconds
        const totalMinutes = Math.floor(displaySeconds / 60);
        const minuteDigits = String(totalMinutes).length;

        if (minuteDigits === 1) {
          baseSize = 58; // 1:XX format
        } else if (minuteDigits === 2) {
          baseSize = 50; // 12:XX format
        } else if (minuteDigits === 3) {
          baseSize = 42; // 123:XX format
        } else {
          baseSize = 35; // 1234:XX+ format
        }
      }
    } else if (timeFormat === 'hh:mm:ss' || (timeFormat === 'hhmmss' && textLength > 6)) {
      baseSize = 36; // Smaller for longer text
    } else if (timeFormat === 'hhmmss' && textLength > 3) {
      baseSize = 48; // Medium for medium text
    } else {
      baseSize = 60; // Original size for short text
    }

    const scaleBoost = 1.5;
    const baseComputed = Math.round(baseSize * scaleFactor * scaleBoost);

    // Constrain font size to fit within the circle
    const baseStrokeWidth = circleStyle === 'fat' ? 16 : circleStyle === 'bw' ? 2 : 8;
    const strokeW = getResponsiveStrokeWidth(baseStrokeWidth);
    const padding = 6;
    const innerDiameter = 2 * (radius - strokeW / 2 - padding);
    const heightMax = innerDiameter * 0.9;

    const charFactor = 0.6; // width per digit relative to font size
    const colonFactor = 0.3; // width for ':' relative to font size
    const unitFactor = 0.35; // width for unit letters like 'h'

    const totalForDisplay = displaySeconds;
    const hourDigits = String(Math.floor(totalForDisplay / 3600)).length || 1;
    const secondsVal = Math.floor(totalForDisplay % 60);
    const secondsDigits = String(secondsVal).length;
    const minutesTotal = Math.floor(totalForDisplay / 60);
    const minuteDigits = String(minutesTotal).length || 1;

    let widthFactor;
    const daysTotal = Math.floor(totalForDisplay / 86400);
    const dayDigits = String(daysTotal).length || 1;
    const dayLabelScale = 0.3; // render 'Day' at 30% of main font size
    const dayLabelWidth = unitFactor * 3 * dayLabelScale; // approximate width for 'Day' at scaled size
    const gapFactor = charFactor * 0.2; // small spacing between day digits and 'Day'
    const afterGapFactor = charFactor * 0.3; // spacing between 'Day' and hours
    if (timeFormat === 'mm') {
      if (isVeryLongDuration) {
        // DDayHH + 'h'
        widthFactor = charFactor * dayDigits + gapFactor + dayLabelWidth + afterGapFactor + (2 * charFactor) + unitFactor;
      } else if (isLongDuration) {
        // HHMM (no 'm') but with 'h'
        widthFactor = charFactor * (hourDigits + 2) + unitFactor; // hours + 2 minute digits + 'h'
      } else if (displaySeconds < 60) {
        // seconds only (SS)
        widthFactor = charFactor * secondsDigits;
      } else {
        // minutes only (MM...)
        const minuteDigitsMM = String(Math.ceil(totalForDisplay / 60)).length || 1;
        widthFactor = charFactor * minuteDigitsMM;
      }
    } else if (timeFormat === 'mm:ss') {
      if (isVeryLongDuration) {
        // DDayHH + 'h'
        widthFactor = charFactor * dayDigits + gapFactor + dayLabelWidth + afterGapFactor + (2 * charFactor) + unitFactor;
      } else if (isLongDuration) {
        // HH:MM (no 'm') but with 'h' and colon
        widthFactor = charFactor * (hourDigits + 2) + unitFactor + colonFactor;
      } else {
        // MM:SS
        widthFactor = charFactor * (minuteDigits + 2) + colonFactor;
      }
    } else {
      // Fallback based on text length
      widthFactor = charFactor * textLength;
    }

    if (!widthFactor || widthFactor <= 0) widthFactor = charFactor * 2; // safety

    const widthMax = innerDiameter / widthFactor;
    const finalSize = Math.floor(Math.min(baseComputed, widthMax * 0.98, heightMax));
    return finalSize;
  };

  // Digit clicking functions
  const getTimeComponents = () => {
    const total = getDisplaySeconds();
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;

    return {
      hours: isNaN(h) ? 0 : h,
      minutes: isNaN(m) ? 0 : m,
      seconds: isNaN(s) ? 0 : s,
      totalSeconds: total
    };
  };

  /**
   * CORE DIGIT CLICKING FUNCTION
   * Handles increment/decrement of individual timer digits when clicked
   *
   * @param {string} digitType - Type of digit ('totalMinutes', 'minutes', 'seconds', 'hours', 'minutesWithinHour')
   * @param {number} digitPosition - Position of digit (0 = leftmost/highest place value)
   * @param {boolean} isIncrement - True for increment (top half click), false for decrement (bottom half)
   */
  const adjustDigit = (digitType, digitPosition, isIncrement = true) => {
    const { seconds, totalSeconds } = getTimeComponents();
    let newDuration = currentDuration;

    switch (digitType) {
      // MM FORMAT: Unlimited minutes (1, 10, 100, 999+)
      case 'totalMinutes': {
        const currentTotalMinutes = Math.ceil(totalSeconds / 60);
        const totalMinuteStr = String(currentTotalMinutes);
        const numDigits = totalMinuteStr.length;

        // Safety check: prevent clicking on non-existent digit positions
        if (digitPosition >= numDigits) break;

        // Calculate place value (1, 10, 100, etc.) based on digit position
        // Position 0 = leftmost digit (highest value), Position 1 = next digit, etc.
        const placeValue = Math.pow(10, numDigits - 1 - digitPosition);

        // Add or subtract the place value with borrow-aware decrement
        let newTotalMinutes;
        if (isIncrement) {
          newTotalMinutes = currentTotalMinutes + placeValue;
        } else {
          const candidate = currentTotalMinutes - placeValue;
          if (candidate <= 0) {
            // If decrement crosses digit boundary (e.g., 100 -> 0), fallback to max of lower digit range (e.g., 99)
            const fallback = numDigits > 1 ? Math.pow(10, numDigits - 1) - 1 : 1;
            newTotalMinutes = fallback;
          } else {
            newTotalMinutes = candidate;
          }
        }

        // Clamp to bounds
        newTotalMinutes = Math.min(MAX_MINUTES_EFFECTIVE, Math.max(1, newTotalMinutes));

        // Convert back to seconds for timer duration; clear seconds to avoid ceil rounding to next minute
        newDuration = newTotalMinutes * 60;
        break;
      }

      // MM:SS FORMAT: Minutes part behaves like totalMinutes (unlimited)
      case 'minutes': {
        const currentMinutesTotal = Math.floor(totalSeconds / 60);
        const minutesStr = String(currentMinutesTotal);
        const numMinuteDigits = minutesStr.length;

        // Safety check for valid digit position
        if (digitPosition >= numMinuteDigits) break;

        // Calculate place value for proper carry-over (same logic as totalMinutes)
        const minutePlaceValue = Math.pow(10, numMinuteDigits - 1 - digitPosition);

        // Add or subtract place value with borrow-aware decrement
        let newMinutesTotal;
        if (isIncrement) {
          newMinutesTotal = currentMinutesTotal + minutePlaceValue;
        } else {
          const candidate = currentMinutesTotal - minutePlaceValue;
          if (candidate <= 0) {
            const fallback = numMinuteDigits > 1 ? Math.pow(10, numMinuteDigits - 1) - 1 : 0;
            newMinutesTotal = fallback;
          } else {
            newMinutesTotal = candidate;
          }
        }

        // Clamp within bounds for MM:SS minutes (allow 0 minutes)
        newMinutesTotal = Math.min(MAX_MINUTES_EFFECTIVE, Math.max(0, newMinutesTotal));

        // Preserve current seconds and update total duration, ensuring at least 1 second total
        const currentSeconds = totalSeconds % 60;
        newDuration = Math.max(1, newMinutesTotal * 60 + currentSeconds);
        break;
      }

      // SECONDS FORMAT: Traditional 0-59 seconds with proper minute carry-over
      case 'seconds': {
        // Simple place value: position 0 = tens (10), position 1 = ones (1)
        const secondPlaceValue = digitPosition === 0 ? 10 : 1;

        // Add or subtract the place value
        let newSeconds = isIncrement ?
          seconds + secondPlaceValue :
          seconds - secondPlaceValue;

        // Calculate carry-over to minutes
        let carryOverMinutes = 0;

        // Handle seconds overflow (e.g., 59 + 1 = 60 → 00 + 1 minute)
        if (newSeconds >= 60) {
          carryOverMinutes = Math.floor(newSeconds / 60);
          newSeconds = newSeconds % 60;
        }
        // Handle seconds underflow (e.g., 00 - 1 = -1 → 59 - 1 minute)
        else if (newSeconds < 0) {
          carryOverMinutes = Math.ceil(newSeconds / 60);  // This will be negative
          newSeconds = ((newSeconds % 60) + 60) % 60;
        }

        // Apply carry-over to total minutes (for MM:SS format)
        const currentMinutesFromSeconds = Math.floor(totalSeconds / 60);
        let updatedMinutes = currentMinutesFromSeconds + carryOverMinutes;

        // Bound minutes within 0..MAX_MINUTES and seconds within 0..59
        if (updatedMinutes < 0) {
          updatedMinutes = 0;
          newSeconds = 0;
        } else if (updatedMinutes > MAX_MINUTES_EFFECTIVE) {
          updatedMinutes = MAX_MINUTES_EFFECTIVE;
          newSeconds = 59;
        }

        // Update duration with new minutes and seconds; enforce minimum total of 1 second
        newDuration = Math.max(1, updatedMinutes * 60 + newSeconds);
        break;
      }

      // HOURS DIGITS for HHMM / HH:MM
      case 'hours': {
        const hours = Math.floor(totalSeconds / 3600);
        const minutesWithinHour = Math.floor((totalSeconds % 3600) / 60);
        const secondsWithinMinute = totalSeconds % 60;
        const hourStr = String(hours);
        const numDigits = hourStr.length || 1;
        if (digitPosition >= numDigits) break;
        const placeValue = Math.pow(10, numDigits - 1 - digitPosition);

        let newHours = isIncrement ? hours + placeValue : hours - placeValue;
        if (newHours < 0) newHours = 0;

        let newTotalMinutes = newHours * 60 + minutesWithinHour;
        if (newTotalMinutes < 0) newTotalMinutes = 0;
        if (newTotalMinutes > MAX_MINUTES_EFFECTIVE) newTotalMinutes = MAX_MINUTES_EFFECTIVE;
        newDuration = newTotalMinutes * 60 + secondsWithinMinute;
        break;
      }

      // MINUTES within hour for HHMM / HH:MM (two digits 00-59 with carry to hours)
      case 'minutesWithinHour': {
        const hours = Math.floor(totalSeconds / 3600);
        const minutesWithinHour = Math.floor((totalSeconds % 3600) / 60);
        const placeValue = digitPosition === 0 ? 10 : 1; // tens or ones

        let newMinutes = isIncrement ? minutesWithinHour + placeValue : minutesWithinHour - placeValue;
        let newHours = hours;

        if (newMinutes >= 60) {
          const carryHours = Math.floor(newMinutes / 60);
          newMinutes = newMinutes % 60;
          newHours = Math.max(0, newHours + carryHours);
        } else if (newMinutes < 0) {
          const borrowHours = -Math.ceil((-newMinutes) / 60); // e.g., -1..-59 => -1
          newHours = Math.max(0, newHours + borrowHours);
          newMinutes = newMinutes - borrowHours * 60; // bring back into 0..59 range
          if (newHours === 0 && newMinutes < 0) {
            newMinutes = 0; // cannot go below 0 total
          }
        }

        let newTotalMinutes = newHours * 60 + newMinutes;
        if (newTotalMinutes < 0) newTotalMinutes = 0; // allow zero
        if (newTotalMinutes > MAX_MINUTES_EFFECTIVE) newTotalMinutes = MAX_MINUTES_EFFECTIVE;
        newDuration = newTotalMinutes * 60 + (totalSeconds % 60);
        break;
      }

      // DAYS for DDayHH (when >24h)
      case 'days': {
        const days = Math.floor(totalSeconds / 86400);
        const hoursWithinDay = Math.floor((totalSeconds % 86400) / 3600);
        const minutesWithinHour = Math.floor((totalSeconds % 3600) / 60);
        const secondsWithinMinute = totalSeconds % 60;
        const dayStr = String(days);
        const numDigits = dayStr.length || 1;
        if (digitPosition >= numDigits) break;
        const placeValue = Math.pow(10, numDigits - 1 - digitPosition);

        // Special-case borrow: when decreasing at 1 Day and hour is 00, fallback to 23h preserving minutes/seconds
        if (!isIncrement && placeValue === 1 && days >= 1 && hoursWithinDay === 0) {
          const newDaysBorrow = Math.max(0, days - 1);
          let borrowTotalMinutes = newDaysBorrow * 24 * 60 + 23 * 60 + minutesWithinHour;
          if (borrowTotalMinutes < 0) borrowTotalMinutes = 0;
          if (borrowTotalMinutes > MAX_MINUTES_EFFECTIVE) borrowTotalMinutes = MAX_MINUTES_EFFECTIVE;
          newDuration = borrowTotalMinutes * 60 + secondsWithinMinute;
          break;
        }

        let newDays = isIncrement ? days + placeValue : days - placeValue;
        if (newDays < 0) newDays = 0;
        let newTotalMinutes = newDays * 24 * 60 + hoursWithinDay * 60 + minutesWithinHour;
        if (newTotalMinutes < 0) newTotalMinutes = 0;
        if (newTotalMinutes > MAX_MINUTES_EFFECTIVE) newTotalMinutes = MAX_MINUTES_EFFECTIVE;
        newDuration = newTotalMinutes * 60 + secondsWithinMinute;
        break;
      }

      // HOURS within day for DDayHH (two digits 00-23 with carry to days)
      case 'hoursWithinDay': {
        const days = Math.floor(totalSeconds / 86400);
        const hoursInDay = Math.floor((totalSeconds % 86400) / 3600);
        const minutesWithinHour = Math.floor((totalSeconds % 3600) / 60);
        const placeValue = digitPosition === 0 ? 10 : 1; // tens or ones

        let newHours = isIncrement ? hoursInDay + placeValue : hoursInDay - placeValue;
        let newDays = days;

        if (newHours >= 24) {
          const carryDays = Math.floor(newHours / 24);
          newHours = newHours % 24;
          newDays = Math.max(0, newDays + carryDays);
        } else if (newHours < 0) {
          const borrowDays = -Math.ceil((-newHours) / 24);
          newDays = Math.max(0, newDays + borrowDays);
          newHours = newHours - borrowDays * 24; // bring back to 0..23
          if (newDays === 0 && newHours < 0) {
            newHours = 0;
          }
        }

        let newTotalMinutes = newDays * 24 * 60 + newHours * 60 + minutesWithinHour;
        if (newTotalMinutes < 0) newTotalMinutes = 0;
        if (newTotalMinutes > MAX_MINUTES_EFFECTIVE) newTotalMinutes = MAX_MINUTES_EFFECTIVE;
        newDuration = newTotalMinutes * 60 + (totalSeconds % 60);
        break;
      }

      default:
        // No action for unknown digit types
        break;
    }

    // UPDATE TIMER STATE
    setCurrentDuration(newDuration);          // Update the base duration
    const newTime = countUp ? 0 : newDuration;
    setTime(newTime);                         // Reset timer to new duration (or 0 for count-up)
    setSmoothTime(newTime);                   // Sync smooth time with discrete time

    // UPDATE URL PARAMETERS (so page refresh preserves the new duration)
    const newParams = new URLSearchParams(window.location.search);
    newParams.set('duration', newDuration.toString());
    window.history.replaceState({}, '', `${window.location.pathname}?${newParams.toString()}`);

    // SYNC BACK TO SETTINGS STORAGE (two-way sync)
    try {
      const STORAGE_KEY = 'mqt-timer-settings';
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : {};
      parsed.duration = newDuration; // store in seconds consistently
      parsed.durationUnit = 'sec';
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    } catch (e) {
      // ignore storage errors
    }

    // VISUAL FEEDBACK (200ms flash: green for increment, red for decrement)
    // setEditingDigit(`${digitType}-${digitPosition}-${isIncrement ? 'inc' : 'dec'}`);
    // setTimeout(() => setEditingDigit(null), 200);
  };

  /**
   * CLICKABLE TIME RENDERER
   * Renders timer digits as clickable SVG elements with top/bottom click areas
   * Each digit can be incremented (top half) or decremented (bottom half)
   *
   * Layout Strategy:
   * - Each digit gets two invisible rectangles (top/bottom half)
   * - Text element is set to pointerEvents="none" to avoid click conflicts
   * - Dynamic positioning adjusts based on number of digits
   */
  const renderClickableTime = () => {
    const fontSize = getDynamicFontSize();
    const elements = [];

    // LAYOUT CALCULATIONS
    // Character width approximation for digit spacing (60% of font size)
    const charWidth = fontSize * 0.6;
    // Colon/unit width for spacing (30% of font size for colon, 35% for unit letters)
    const colonWidth = fontSize * 0.3;
    const unitWidth = fontSize * 0.35;

    const displaySeconds = getDisplaySeconds();

    switch (timeFormat) {
      // MM FORMAT: Unlimited minutes (1, 10, 100, 999+) with auto-switch
      case 'mm': {
        const totalTime = displaySeconds;

        // If duration is configured as "long", switch to HHMM (or DDayHH when >24h)
        if (isVeryLongDuration) {
          const totalForDisplay = displaySeconds;
          const days = Math.floor(totalForDisplay / 86400);
          const hoursInDay = Math.floor((totalForDisplay % 86400) / 3600);
          const dayStr = String(days);
          const hourStr = String(hoursInDay).padStart(2, '0');

          const dayLabel = 'Day';
          const dayLabelScale = 0.3;
          const dayLabelWidth = unitWidth * dayLabel.length * dayLabelScale;
          const gapWidth = charWidth * 0.2; // small gap between day digits and 'Day'
          const afterDayGap = charWidth * 0.3; // gap between 'Day' and hours
          const totalWidth = (dayStr.length * charWidth) + gapWidth + dayLabelWidth + afterDayGap + (2 * charWidth) + unitWidth; // D + gap + 'Day' + gap + HH + 'h'
          const startX = 120 - totalWidth / 2;

          // Render day digits
          for (let i = 0; i < dayStr.length; i++) {
            const digitX = startX + (i * charWidth) + (charWidth / 2);
            elements.push(
              <g key={`days-digit-${i}-group`} onClick={(e) => e.stopPropagation()}>
                <rect
                  x={digitX - charWidth / 2}
                  y={125 - fontSize / 2}
                  width={charWidth}
                  height={fontSize / 2}
                  fill="transparent"
                  className="timer-digit-clickable"
                  onClick={canEditDigits ? () => adjustDigit('days', i, true) : undefined}
                  pointerEvents={canEditDigits ? 'auto' : 'none'}
                />
                <rect
                  x={digitX - charWidth / 2}
                  y={125}
                  width={charWidth}
                  height={fontSize / 2}
                  fill="transparent"
                  className="timer-digit-clickable"
                  onClick={canEditDigits ? () => adjustDigit('days', i, false) : undefined}
                  pointerEvents={canEditDigits ? 'auto' : 'none'}
                />
                <text
                  x={digitX}
                  y={125}
                  textAnchor="middle"
                  fontFamily={effectiveFontFamily}
                  fontSize={fontSize}
                  fill={editingDigit?.startsWith(`days-${i}`) ? (editingDigit.includes('inc') ? '#4caf50' : '#ff6b6b') : dynamicTextColor}
                  pointerEvents="none"
                >
                  {dayStr[i]}
                </text>
              </g>
            );
          }

          // 'Day' label
          const dayX = startX + (dayStr.length * charWidth) + gapWidth + (dayLabelWidth / 2);
          elements.push(
            <text
              key="unit-day"
              x={dayX}
              y={125}
              textAnchor="middle"
              fontFamily={effectiveFontFamily}
              fontSize={fontSize * dayLabelScale}
              fill={dynamicTextColor}
            >
              {dayLabel}
            </text>
          );

          // Hours within the day (two digits)
          const hoursStart = dayX + (dayLabelWidth / 2) + afterDayGap;
          for (let i = 0; i < 2; i++) {
            const digitX = hoursStart + (i * charWidth) + (charWidth / 2);
            elements.push(
              <g key={`hwd-digit-${i}-group`} onClick={(e) => e.stopPropagation()}>
                <rect
                  x={digitX - charWidth / 2}
                  y={125 - fontSize / 2}
                  width={charWidth}
                  height={fontSize / 2}
                  fill="transparent"
                  className="timer-digit-clickable"
                  onClick={canEditDigits ? () => adjustDigit('hoursWithinDay', i, true) : undefined}
                  pointerEvents={canEditDigits ? 'auto' : 'none'}
                />
                <rect
                  x={digitX - charWidth / 2}
                  y={125}
                  width={charWidth}
                  height={fontSize / 2}
                  fill="transparent"
                  className="timer-digit-clickable"
                  onClick={canEditDigits ? () => adjustDigit('hoursWithinDay', i, false) : undefined}
                  pointerEvents={canEditDigits ? 'auto' : 'none'}
                />
                <text
                  x={digitX}
                  y={125}
                  textAnchor="middle"
                  fontFamily={effectiveFontFamily}
                  fontSize={fontSize}
                  fill={editingDigit?.startsWith(`hoursWithinDay-${i}`) ? (editingDigit.includes('inc') ? '#4caf50' : '#ff6b6b') : dynamicTextColor}
                  pointerEvents="none"
                >
                  {hourStr[i]}
                </text>
              </g>
            );
          }

          // 'h' unit after hours
          const hX2 = hoursStart + (2 * charWidth) + (unitWidth / 2);
          elements.push(
            <text
              key="unit-h-dday"
              x={hX2}
              y={125}
              textAnchor="middle"
              fontFamily={effectiveFontFamily}
              fontSize={fontSize * 0.3}
              fill={dynamicTextColor}
            >
              h
            </text>
          );

        } else if (isLongDuration) {
          const totalForDisplay = displaySeconds;
          const hours = Math.floor(totalForDisplay / 3600);
          const minutesInHour = Math.floor((totalForDisplay % 3600) / 60);
          const hourStr = String(hours);
          const minuteStr = String(minutesInHour).padStart(2, '0');

          const totalWidth = (hourStr.length * charWidth) + unitWidth + (2 * charWidth); // H + 'h' + MM
          const startX = 120 - totalWidth / 2;

          // Render hour digits
          for (let i = 0; i < hourStr.length; i++) {
            const digitX = startX + (i * charWidth) + (charWidth / 2);
            elements.push(
              <g key={`hours-digit-${i}-group`} onClick={(e) => e.stopPropagation()}>
                <rect
                  x={digitX - charWidth / 2}
                  y={125 - fontSize / 2}
                  width={charWidth}
                  height={fontSize / 2}
                  fill="transparent"
                  className="timer-digit-clickable"
                  onClick={canEditDigits ? () => adjustDigit('hours', i, true) : undefined}
                  pointerEvents={canEditDigits ? 'auto' : 'none'}
                />
                <rect
                  x={digitX - charWidth / 2}
                  y={125}
                  width={charWidth}
                  height={fontSize / 2}
                  fill="transparent"
                  className="timer-digit-clickable"
                  onClick={canEditDigits ? () => adjustDigit('hours', i, false) : undefined}
                  pointerEvents={canEditDigits ? 'auto' : 'none'}
                />
                <text
                  x={digitX}
                  y={125}
                  textAnchor="middle"
                  fontFamily={effectiveFontFamily}
                  fontSize={fontSize}
                  fill={editingDigit?.startsWith(`hours-${i}`) ? (editingDigit.includes('inc') ? '#4caf50' : '#ff6b6b') : dynamicTextColor}
                  pointerEvents="none"
                >
                  {hourStr[i]}
                </text>
              </g>
            );
          }

          // 'h' unit
          const hX = startX + (hourStr.length * charWidth) + (unitWidth / 2);
          elements.push(
            <text
              key="unit-h"
              x={hX}
              y={125}
              textAnchor="middle"
              fontFamily={effectiveFontFamily}
              fontSize={fontSize * 0.3}
              fill={dynamicTextColor}
            >
              h
            </text>
          );

          // Minutes within the hour (two digits)
          const minutesStart = hX + (unitWidth / 2);
          for (let i = 0; i < 2; i++) {
            const digitX = minutesStart + (i * charWidth) + (charWidth / 2);
            elements.push(
              <g key={`minwh-digit-${i}-group`} onClick={(e) => e.stopPropagation()}>
                <rect
                  x={digitX - charWidth / 2}
                  y={125 - fontSize / 2}
                  width={charWidth}
                  height={fontSize / 2}
                  fill="transparent"
                  className="timer-digit-clickable"
                  onClick={canEditDigits ? () => adjustDigit('minutesWithinHour', i, true) : undefined}
                  pointerEvents={canEditDigits ? 'auto' : 'none'}
                />
                <rect
                  x={digitX - charWidth / 2}
                  y={125}
                  width={charWidth}
                  height={fontSize / 2}
                  fill="transparent"
                  className="timer-digit-clickable"
                  onClick={canEditDigits ? () => adjustDigit('minutesWithinHour', i, false) : undefined}
                  pointerEvents={canEditDigits ? 'auto' : 'none'}
                />
                <text
                  x={digitX}
                  y={125}
                  textAnchor="middle"
                  fontFamily={effectiveFontFamily}
                  fontSize={fontSize}
                  fill={editingDigit?.startsWith(`minutesWithinHour-${i}`) ? (editingDigit.includes('inc') ? '#4caf50' : '#ff6b6b') : dynamicTextColor}
                  pointerEvents="none"
                >
                  {minuteStr[i]}
                </text>
              </g>
            );
          }


        }
        // Check if we should switch to SS format (last minute)
        else if (totalTime < 60) {
          // SS MODE: Show seconds directly (59, 58, 57...)
          const currentSeconds = Math.floor(totalTime % 60);
          const secondsStr = String(currentSeconds);
          const numSecondDigits = secondsStr.length;

          if (numSecondDigits === 1) {
            // SINGLE DIGIT SECONDS DISPLAY
            elements.push(
              <g key="sec-single-group" onClick={(e) => e.stopPropagation()}>
                {/* Top half click area - increment seconds */}
                <rect
                  x={120 - charWidth / 2}
                  y={125 - fontSize / 2}
                  width={charWidth}
                  height={fontSize / 2}
                  fill="transparent"
                  className="timer-digit-clickable"
                  onClick={canEditDigits ? () => adjustDigit('seconds', 0, true) : undefined}
                  pointerEvents={canEditDigits ? 'auto' : 'none'}
                />
                {/* Bottom half click area - decrement seconds */}
                <rect
                  x={120 - charWidth / 2}
                  y={125}
                  width={charWidth}
                  height={fontSize / 2}
                  fill="transparent"
                  className="timer-digit-clickable"
                  onClick={canEditDigits ? () => adjustDigit('seconds', 0, false) : undefined}
                  pointerEvents={canEditDigits ? 'auto' : 'none'}
                />
                {/* Seconds text display */}
                <text
                  x={120}
                  y={125}
                  textAnchor="middle"
                  fontFamily={effectiveFontFamily}
                  fontSize={fontSize}
                  fill={editingDigit?.startsWith('seconds-0') ? (editingDigit.includes('inc') ? '#4caf50' : '#ff6b6b') : dynamicTextColor}
                  pointerEvents="none"
                >
                  {secondsStr}
                </text>
              </g>
            );
          } else {
            // TWO DIGIT SECONDS DISPLAY
            const centerOffset = (numSecondDigits - 1) * charWidth / 2;
            for (let i = 0; i < numSecondDigits; i++) {
              const digitX = 120 - centerOffset + (i * charWidth);
              elements.push(
                <g key={`sec-digit-${i}-group`} onClick={(e) => e.stopPropagation()}>
                  {/* Top half click area - increment */}
                  <rect
                    x={digitX - charWidth / 2}
                    y={125 - fontSize / 2}
                    width={charWidth}
                    height={fontSize / 2}
                    fill="transparent"
                    className="timer-digit-clickable"
                    onClick={canEditDigits ? () => adjustDigit('seconds', i, true) : undefined}
                    pointerEvents={canEditDigits ? 'auto' : 'none'}
                  />
                  {/* Bottom half click area - decrement */}
                  <rect
                    x={digitX - charWidth / 2}
                    y={125}
                    width={charWidth}
                    height={fontSize / 2}
                    fill="transparent"
                    className="timer-digit-clickable"
                    onClick={canEditDigits ? () => adjustDigit('seconds', i, false) : undefined}
                    pointerEvents={canEditDigits ? 'auto' : 'none'}
                  />
                  {/* Digit text */}
                  <text
                    x={digitX}
                    y={125}
                    textAnchor="middle"
                    fontFamily={effectiveFontFamily}
                    fontSize={fontSize}
                    fill={editingDigit?.startsWith(`seconds-${i}`) ? (editingDigit.includes('inc') ? '#4caf50' : '#ff6b6b') : dynamicTextColor}
                    pointerEvents="none"
                  >
                    {secondsStr[i]}
                  </text>
                </g>
              );
            }
          }
        } else {
          // MM MODE: Show minutes normally (60+ seconds)
          const totalMinutes = Math.ceil(totalTime / 60);
          const minuteStr = String(totalMinutes); // No leading zeros for unlimited format
          const numDigits = minuteStr.length;

          // MULTI-DIGIT MINUTES DISPLAY (2, 3, 4+ digits automatically centered)
          // Calculate offset to center all digits around x=120
          const centerOffset = (numDigits - 1) * charWidth / 2;

          // Render each digit with its own click areas
          for (let i = 0; i < numDigits; i++) {
            const digitX = 120 - centerOffset + (i * charWidth);
            elements.push(
              <g key={`min-digit-${i}-group`} onClick={(e) => e.stopPropagation()}>
                {/* Top half click area - increment */}
                <rect
                  x={digitX - charWidth / 2}
                  y={125 - fontSize / 2}
                  width={charWidth}
                  height={fontSize / 2}
                  fill="transparent"
                  className="timer-digit-clickable"
                  onClick={canEditDigits ? () => adjustDigit('totalMinutes', i, true) : undefined}
                  pointerEvents={canEditDigits ? 'auto' : 'none'}
                />
                {/* Bottom half click area - decrement */}
                <rect
                  x={digitX - charWidth / 2}
                  y={125}
                  width={charWidth}
                  height={fontSize / 2}
                  fill="transparent"
                  className="timer-digit-clickable"
                  onClick={canEditDigits ? () => adjustDigit('totalMinutes', i, false) : undefined}
                  pointerEvents={canEditDigits ? 'auto' : 'none'}
                />
                {/* Digit text */}
                <text
                  x={digitX}
                  y={125}
                  textAnchor="middle"
                  fontFamily={effectiveFontFamily}
                  fontSize={fontSize}
                  fill={editingDigit?.startsWith(`totalMinutes-${i}`) ? (editingDigit.includes('inc') ? '#4caf50' : '#ff6b6b') : dynamicTextColor}
                  pointerEvents="none"
                >
                  {minuteStr[i]}
                </text>
              </g>
            );
          }
        }
        break;
      }

      // MM:SS FORMAT: Unlimited minutes + traditional seconds (0-59)
      case 'mm:ss': {
        if (isVeryLongDuration) {
          const totalForDisplay = displaySeconds;
          const days = Math.floor(totalForDisplay / 86400);
          const hoursInDay = Math.floor((totalForDisplay % 86400) / 3600);
          const dayStr = String(days);
          const hourStr = String(hoursInDay).padStart(2, '0');

          const dayLabel = 'Day';
          const dayLabelScale = 0.3;
          const dayLabelWidth = unitWidth * dayLabel.length * dayLabelScale;
          const gapWidth = charWidth * 0.2; // small gap between day digits and 'Day'
          const afterDayGap = charWidth * 0.3; // gap between 'Day' and hours
          const totalWidth = (dayStr.length * charWidth) + gapWidth + dayLabelWidth + afterDayGap + (2 * charWidth) + unitWidth;
          const startX = 120 - totalWidth / 2;

          // Days
          for (let i = 0; i < dayStr.length; i++) {
            const digitX = startX + (i * charWidth) + (charWidth / 2);
            elements.push(
              <g key={`days-digit-${i}-group`} onClick={(e) => e.stopPropagation()}>
                <rect
                  x={digitX - charWidth / 2}
                  y={125 - fontSize / 2}
                  width={charWidth}
                  height={fontSize / 2}
                  fill="transparent"
                  className="timer-digit-clickable"
                  onClick={canEditDigits ? () => adjustDigit('days', i, true) : undefined}
                  pointerEvents={canEditDigits ? 'auto' : 'none'}
                />
                <rect
                  x={digitX - charWidth / 2}
                  y={125}
                  width={charWidth}
                  height={fontSize / 2}
                  fill="transparent"
                  className="timer-digit-clickable"
                  onClick={canEditDigits ? () => adjustDigit('days', i, false) : undefined}
                  pointerEvents={canEditDigits ? 'auto' : 'none'}
                />
                <text
                  x={digitX}
                  y={125}
                  textAnchor="middle"
                  fontFamily={effectiveFontFamily}
                  fontSize={fontSize}
                  fill={editingDigit?.startsWith(`days-${i}`) ? (editingDigit.includes('inc') ? '#4caf50' : '#ff6b6b') : dynamicTextColor}
                  pointerEvents="none"
                >
                  {dayStr[i]}
                </text>
              </g>
            );
          }

          // 'Day'
          const dayX = startX + (dayStr.length * charWidth) + gapWidth + (dayLabelWidth / 2);
          elements.push(
            <text
              key="unit-day"
              x={dayX}
              y={125}
              textAnchor="middle"
              fontFamily={effectiveFontFamily}
              fontSize={fontSize * dayLabelScale}
              fill={dynamicTextColor}
            >
              Day
            </text>
          );

          // Hours within day (two digits)
          const hoursStart = dayX + (dayLabelWidth / 2) + afterDayGap;
          for (let i = 0; i < 2; i++) {
            const digitX = hoursStart + (i * charWidth) + (charWidth / 2);
            elements.push(
              <g key={`hwd-digit-${i}-group`} onClick={(e) => e.stopPropagation()}>
                <rect
                  x={digitX - charWidth / 2}
                  y={125 - fontSize / 2}
                  width={charWidth}
                  height={fontSize / 2}
                  fill="transparent"
                  className="timer-digit-clickable"
                  onClick={canEditDigits ? () => adjustDigit('hoursWithinDay', i, true) : undefined}
                  pointerEvents={canEditDigits ? 'auto' : 'none'}
                />
                <rect
                  x={digitX - charWidth / 2}
                  y={125}
                  width={charWidth}
                  height={fontSize / 2}
                  fill="transparent"
                  className="timer-digit-clickable"
                  onClick={canEditDigits ? () => adjustDigit('hoursWithinDay', i, false) : undefined}
                  pointerEvents={canEditDigits ? 'auto' : 'none'}
                />
                <text
                  x={digitX}
                  y={125}
                  textAnchor="middle"
                  fontFamily={effectiveFontFamily}
                  fontSize={fontSize}
                  fill={editingDigit?.startsWith(`hoursWithinDay-${i}`) ? (editingDigit.includes('inc') ? '#4caf50' : '#ff6b6b') : dynamicTextColor}
                  pointerEvents="none"
                >
                  {hourStr[i]}
                </text>
              </g>
            );
          }

          // 'h'
          const hX2 = hoursStart + (2 * charWidth) + (unitWidth / 2);
          elements.push(
            <text
              key="unit-h-dday"
              x={hX2}
              y={125}
              textAnchor="middle"
              fontFamily={effectiveFontFamily}
              fontSize={fontSize * 0.3}
              fill={dynamicTextColor}
            >
              h
            </text>
          );

        } else if (isLongDuration) {
          // Switch to HH:MM when total duration exceeds threshold
          const totalForDisplay = displaySeconds;
          const hours = Math.floor(totalForDisplay / 3600);
          const minutesInHour = Math.floor((totalForDisplay % 3600) / 60);
          const hourStr = String(hours);
          const minuteStr = String(minutesInHour).padStart(2, '0');

          // width: H + 'h' + ':' + MM
          const totalWidth = (hourStr.length * charWidth) + unitWidth + colonWidth + (2 * charWidth);
          const startX = 120 - totalWidth / 2;

          // Hours
          for (let i = 0; i < hourStr.length; i++) {
            const digitX = startX + (i * charWidth) + (charWidth / 2);
            elements.push(
              <g key={`hours-digit-${i}-group`} onClick={(e) => e.stopPropagation()}>
                <rect
                  x={digitX - charWidth / 2}
                  y={125 - fontSize / 2}
                  width={charWidth}
                  height={fontSize / 2}
                  fill="transparent"
                  className="timer-digit-clickable"
                  onClick={canEditDigits ? () => adjustDigit('hours', i, true) : undefined}
                  pointerEvents={canEditDigits ? 'auto' : 'none'}
                />
                <rect
                  x={digitX - charWidth / 2}
                  y={125}
                  width={charWidth}
                  height={fontSize / 2}
                  fill="transparent"
                  className="timer-digit-clickable"
                  onClick={canEditDigits ? () => adjustDigit('hours', i, false) : undefined}
                  pointerEvents={canEditDigits ? 'auto' : 'none'}
                />
                <text
                  x={digitX}
                  y={125}
                  textAnchor="middle"
                  fontFamily={effectiveFontFamily}
                  fontSize={fontSize}
                  fill={editingDigit?.startsWith(`hours-${i}`) ? (editingDigit.includes('inc') ? '#4caf50' : '#ff6b6b') : dynamicTextColor}
                  pointerEvents="none"
                >
                  {hourStr[i]}
                </text>
              </g>
            );
          }

          // 'h' unit
          const hX = startX + (hourStr.length * charWidth) + (unitWidth / 2);
          elements.push(
            <text
              key="unit-h"
              x={hX}
              y={125}
              textAnchor="middle"
              fontFamily={effectiveFontFamily}
              fontSize={fontSize * 0.3}
              fill={dynamicTextColor}
            >
              h
            </text>
          );

          // Colon
          const colonX = hX + (unitWidth / 2) + (colonWidth / 2);
          elements.push(
            <text
              key="colon-hhmm"
              x={colonX}
              y={125}
              textAnchor="middle"
              fontFamily={effectiveFontFamily}
              fontSize={fontSize}
              fill={dynamicTextColor}
            >
              :
            </text>
          );

          // Minutes within the hour (two digits)
          const minutesStart = colonX + (colonWidth / 2);
          for (let i = 0; i < 2; i++) {
            const digitX = minutesStart + (i * charWidth) + (charWidth / 2);
            elements.push(
              <g key={`minwh-digit-${i}-group`} onClick={(e) => e.stopPropagation()}>
                <rect
                  x={digitX - charWidth / 2}
                  y={125 - fontSize / 2}
                  width={charWidth}
                  height={fontSize / 2}
                  fill="transparent"
                  className="timer-digit-clickable"
                  onClick={canEditDigits ? () => adjustDigit('minutesWithinHour', i, true) : undefined}
                  pointerEvents={canEditDigits ? 'auto' : 'none'}
                />
                <rect
                  x={digitX - charWidth / 2}
                  y={125}
                  width={charWidth}
                  height={fontSize / 2}
                  fill="transparent"
                  className="timer-digit-clickable"
                  onClick={canEditDigits ? () => adjustDigit('minutesWithinHour', i, false) : undefined}
                  pointerEvents={canEditDigits ? 'auto' : 'none'}
                />
                <text
                  x={digitX}
                  y={125}
                  textAnchor="middle"
                  fontFamily={effectiveFontFamily}
                  fontSize={fontSize}
                  fill={editingDigit?.startsWith(`minutesWithinHour-${i}`) ? (editingDigit.includes('inc') ? '#4caf50' : '#ff6b6b') : dynamicTextColor}
                  pointerEvents="none"
                >
                  {minuteStr[i]}
                </text>
              </g>
            );
          }


        } else {
          const { totalSeconds } = getTimeComponents();

          // PARSE TIME COMPONENTS
          const mmssMinutes = Math.floor(totalSeconds / 60);  // Total minutes (unlimited: 1, 50, 999+)
          const mmssSeconds = totalSeconds % 60;              // Traditional seconds (0-59)
          const minutesStr = String(mmssMinutes);             // No leading zeros for minutes
          const secondsStr = String(mmssSeconds).padStart(2, '0'); // Always 2 digits for seconds
          const numMinuteDigits = minutesStr.length;

          // DYNAMIC LAYOUT CALCULATION
          // Total width = minutes + colon + seconds (always 2 digits)
          const totalWidth = (numMinuteDigits * charWidth) + colonWidth + (2 * charWidth);
          // Center the entire display around x=120
          const displayStartX = 120 - (totalWidth / 2);

          // RENDER MINUTE DIGITS (unlimited, like MM format)
          for (let i = 0; i < numMinuteDigits; i++) {
            const digitX = displayStartX + (i * charWidth) + (charWidth / 2);
            elements.push(
              <g key={`min-digit-${i}-group`} onClick={(e) => e.stopPropagation()}>
                {/* Top half - increment minute digit */}
                <rect
                  x={digitX - charWidth / 2}
                  y={125 - fontSize / 2}
                  width={charWidth}
                  height={fontSize / 2}
                  fill="transparent"
                  className="timer-digit-clickable"
                  onClick={canEditDigits ? () => adjustDigit('minutes', i, true) : undefined}
                  pointerEvents={canEditDigits ? 'auto' : 'none'}
                />
                {/* Bottom half - decrement minute digit */}
                <rect
                  x={digitX - charWidth / 2}
                  y={125}
                  width={charWidth}
                  height={fontSize / 2}
                  fill="transparent"
                  className="timer-digit-clickable"
                  onClick={canEditDigits ? () => adjustDigit('minutes', i, false) : undefined}
                  pointerEvents={canEditDigits ? 'auto' : 'none'}
                />
                {/* Minute digit text */}
                <text
                  x={digitX}
                  y={125}
                  textAnchor="middle"
                  fontFamily={effectiveFontFamily}
                  fontSize={fontSize}
                  fill={editingDigit?.startsWith(`minutes-${i}`) ? (editingDigit.includes('inc') ? '#4caf50' : '#ff6b6b') : dynamicTextColor}
                  pointerEvents="none"
                >
                  {minutesStr[i]}
                </text>
              </g>
            );
          }

          // RENDER COLON SEPARATOR
          const colonX = displayStartX + (numMinuteDigits * charWidth) + (colonWidth / 2);
          elements.push(
            <text
              key="colon1"
              x={colonX}
              y={125}
              textAnchor="middle"
              fontFamily={effectiveFontFamily}
              fontSize={fontSize}
              fill={dynamicTextColor}
            >
              :
            </text>
          );

          // RENDER SECONDS DIGITS (always 2 digits, 0-59 range)
          const secondsStartX = displayStartX + (numMinuteDigits * charWidth) + colonWidth;

          // Helper function to create seconds digit with consistent pattern
          const createSecondsDigit = (position, digit, digitIndex) => (
            <g key={`sec-${position}-group`} onClick={(e) => e.stopPropagation()}>
              {/* Top half - increment */}
              <rect
                x={secondsStartX + (digitIndex * charWidth)}
                y={125 - fontSize / 2}
                width={charWidth}
                height={fontSize / 2}
                fill="transparent"
                className="timer-digit-clickable"
                onClick={canEditDigits ? () => adjustDigit('seconds', digitIndex, true) : undefined}
                pointerEvents={canEditDigits ? 'auto' : 'none'}
              />
              {/* Bottom half - decrement */}
              <rect
                x={secondsStartX + (digitIndex * charWidth)}
                y={125}
                width={charWidth}
                height={fontSize / 2}
                fill="transparent"
                className="timer-digit-clickable"
                onClick={canEditDigits ? () => adjustDigit('seconds', digitIndex, false) : undefined}
                pointerEvents={canEditDigits ? 'auto' : 'none'}
              />
              {/* Digit text */}
              <text
                x={secondsStartX + (digitIndex * charWidth) + (charWidth / 2)}
                y={125}
                textAnchor="middle"
                fontFamily={effectiveFontFamily}
                fontSize={fontSize}
                fill={editingDigit?.startsWith(`seconds-${digitIndex}`) ? (editingDigit.includes('inc') ? '#4caf50' : '#ff6b6b') : dynamicTextColor}
                pointerEvents="none"
              >
                {digit}
              </text>
            </g>
          );

          // Seconds tens digit (position 0)
          elements.push(createSecondsDigit('tens', secondsStr[0], 0));
          // Seconds ones digit (position 1)
          elements.push(createSecondsDigit('ones', secondsStr[1], 1));
        }
        break;
      }

      default:
        // Fallback to formatTime() for unsupported formats
        elements.push(
          <text
            key="fallback"
            x="120"
            y="125"
            textAnchor="middle"
            fontFamily={effectiveFontFamily}
            fontSize={fontSize}
            fill={dynamicTextColor}
            onClick={(e) => e.stopPropagation()}
          >
            {formatTime()}
          </text>
        );
        break;
    }

    return elements;
  };

  // Optional: Disable keyboard input
  useEffect(() => {
    const handleKey = (e) => {
      if (disableKeyboard) {
        e.preventDefault();
        return;
      }

      if (e.ctrlKey && e.code === 'Enter') {
        e.preventDefault();
        navigate('/');
        return;
      }

      switch (e.code) {
        case 'Enter':
          e.preventDefault();
          setIsRunning(prev => !prev);
          break;
        case 'Space':
          e.preventDefault();
          const resetTime = countUp ? 0 : currentDuration;
          setTime(resetTime);
          setSmoothTime(resetTime);
          endTriggeredRef.current = false;
          setHasEnded(false);
          setIsRunning(false);
          break;
        case 'Equal':
        case 'NumpadAdd':
          e.preventDefault();
          setTime(prev => {
            const maxUp = countUp ? currentDuration : effectiveMaxSeconds;
            const newTime = Math.min(maxUp, prev + plusMinusStep);
            setSmoothTime(newTime);
            return newTime;
          });
          break;
        case 'Minus':
        case 'NumpadSubtract':
          e.preventDefault();
          setTime(prev => {
            const newTime = Math.max(0, prev - plusMinusStep);
            setSmoothTime(newTime);
            return newTime;
          });
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [disableKeyboard, currentDuration, countUp, plusMinusStep, navigate, effectiveMaxSeconds]);


  const handleDisplayClick = (e) => {
    const svgElement = e.currentTarget.querySelector('.circle-svg');
    if (!svgElement) { setIsRunning(prev => !prev); return; }
    const svgRect = svgElement.getBoundingClientRect();
    const centerX = svgRect.left + svgRect.width / 2;
    const centerY = svgRect.top + svgRect.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const distance = Math.hypot(dx, dy);
    const scale = svgRect.width / 240; // viewBox width
    const scaledRadius = radius * scale;
    if (distance > scaledRadius) {
      setIsRunning(prev => !prev);
    }
  };

  return (
    <div className="mqt-display fullscreen theme-black" style={{ cursor: 'none', backgroundColor: hasEnded ? '#ff3c2c' : undefined }} onClick={handleDisplayClick}>
      <svg className="circle-svg" viewBox="0 0 240 240" fontWeight={effectiveFontWeight}>
        {/* Base circle stroke - always visible for progress bar */}
        <circle
          r={radius}
          cx="120"
          cy="120"
          stroke="#666"
          strokeWidth={computedStrokeWidth}
          fill="none"
          opacity={circleStyle === 'bw' ? 0.3 : 1}
        />

        {/* Progress circle */}
        <circle
          ref={circleRef}
          r={radius}
          cx="120"
          cy="120"
          stroke={circleStyle === 'bw' ? dynamicTextColor : dynamicColor}
          strokeWidth={computedStrokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 120 120)"
        />

        {/* End logo overlay with replay function */}
        {hasEnded && (
          <g>
            <rect
              x="0"
              y="0"
              width="240"
              height="240"
              fill="none"
              pointerEvents="all"
            />
            <image 
              href="/logo3.png" 
              x={120 - 70} 
              y={120 - 70} 
              width="140" 
              height="140" 
              preserveAspectRatio="xMidYMid meet"
              onClick={(e) => {
                e.stopPropagation();
                const resetTime = countUp ? 0 : currentDuration;
                setTime(resetTime);
                setSmoothTime(resetTime);
                endTriggeredRef.current = false;
                setHasEnded(false);
                setIsRunning(true); // Start the timer automatically when logo is clicked
              }}
              style={{ cursor: 'pointer' }}
            />
          </g>
        )}

        {/* Clickable timer digits */}
        {!hasEnded && renderClickableTime()}
      </svg>
    </div>

  );
};

export default MqtDisplay;
