import { useEffect, useRef, useState, useCallback } from 'react';

interface WheelData {
  option: string;
  style?: { backgroundColor?: string; textColor?: string };
}

interface RouletteWheelProps {
  mustStartSpinning: boolean;
  prizeNumber: number;
  data: WheelData[];
  onStopSpinning?: () => void;
  backgroundColors?: string[];
  textColors?: string[];
  outerBorderColor?: string;
  outerBorderWidth?: number;
  innerBorderColor?: string;
  radiusLineColor?: string;
  radiusLineWidth?: number;
  fontSize?: number;
  spinDuration?: number; // in seconds
  textDistance?: number;
  perpendicularText?: boolean;
  enableSound?: boolean;
  resetTonearm?: boolean; // When true, animates tonearm back to rest position
}

// Audio context for sound effects
let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return audioContext;
};

const playTickSound = () => {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = 800 + Math.random() * 400;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.05);
  } catch {
    // Audio not supported
  }
};

const playWinSound = () => {
  try {
    const ctx = getAudioContext();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

    notes.forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = freq;
      oscillator.type = 'sine';

      const startTime = ctx.currentTime + i * 0.1;
      gainNode.gain.setValueAtTime(0.15, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

      oscillator.start(startTime);
      oscillator.stop(startTime + 0.3);
    });
  } catch {
    // Audio not supported
  }
};

const RouletteWheel = ({
  mustStartSpinning,
  prizeNumber,
  data,
  onStopSpinning,
  backgroundColors = ['darkgrey'],
  textColors = ['white'],
  outerBorderColor = 'black',
  outerBorderWidth = 5,
  innerBorderColor = 'black',
  radiusLineColor = 'black',
  radiusLineWidth = 5,
  fontSize = 20,
  spinDuration = 0.8,
  textDistance = 60,
  perpendicularText = false,
  enableSound = true,
  resetTonearm = false,
}: RouletteWheelProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(0);
  const [glowIntensity, setGlowIntensity] = useState(0);
  const [canvasSize, setCanvasSize] = useState(600);
  const [confetti, setConfetti] = useState<Array<{x: number, y: number, vx: number, vy: number, color: string, size: number}>>([]);
  const [dpr, setDpr] = useState(1);

  // Animation state
  const isSpinning = useRef(false);
  const startRotation = useRef(0);
  const startTime = useRef(0);
  const totalRotation = useRef(0);
  const lastTickAngle = useRef(0);

  // Tonearm animation state
  const [tonearmAngle, setTonearmAngle] = useState<number | null>(null);
  const tonearmAnimating = useRef(false);
  const tonearmStartTime = useRef(0);

  // Handle responsive canvas sizing and device pixel ratio
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const containerHeight = containerRef.current.offsetHeight;
        // Use the smaller dimension to ensure the wheel fits
        const size = Math.min(containerWidth, containerHeight) || 400;
        setCanvasSize(size);
        // Get device pixel ratio for sharp rendering on high-DPI displays
        setDpr(window.devicePixelRatio || 1);
      }
    };

    updateSize();

    // Use ResizeObserver for more reliable size updates
    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', updateSize);
    return () => {
      window.removeEventListener('resize', updateSize);
      resizeObserver.disconnect();
    };
  }, []);

  // Confetti animation
  useEffect(() => {
    if (confetti.length === 0) return;

    const animateConfetti = () => {
      setConfetti(prev => {
        const updated = prev
          .map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.3 * (canvasSize / 600), // gravity scaled to canvas size
          }))
          .filter(p => p.y < canvasSize + 100); // remove off-screen particles

        return updated;
      });
    };

    const interval = setInterval(animateConfetti, 16);
    return () => clearInterval(interval);
  }, [confetti.length, canvasSize]);

  const spawnConfetti = useCallback(() => {
    const colors = ['#ff8f43', '#f9dd50', '#4CAF50', '#2980B9', '#E74C3C', '#9B59B6'];
    const scale = canvasSize / 600;
    const particles = Array.from({ length: 50 }, () => ({
      x: canvasSize / 2,
      y: 50 * scale,
      vx: (Math.random() - 0.5) * 15 * scale,
      vy: (-Math.random() * 10 - 5) * scale,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: (Math.random() * 8 + 4) * scale,
    }));
    setConfetti(particles);
  }, [canvasSize]);

  // Calculate tonearm rest and playing angles
  const getTonearmAngles = useCallback(() => {
    const scale = canvasSize / 600;
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;
    const scaledBorderWidth = outerBorderWidth * scale;
    const radius = Math.min(centerX, centerY) - scaledBorderWidth - 10 * scale;

    // Pivot positioned to the right of the wheel (in the extra canvas space)
    const pivotX = canvasSize + 40 * scale; // In the 30% extra space on the right
    const pivotY = centerY - radius * 0.3; // Slightly above center

    // Target at 5 o'clock position (on the record edge)
    const targetAngle = Math.PI / 6; // 5 o'clock = 30 degrees below horizontal
    const targetX = centerX + Math.cos(targetAngle) * (radius - 20 * scale);
    const targetY = centerY + Math.sin(targetAngle) * (radius - 20 * scale);

    const playingAngle = Math.atan2(targetY - pivotY, targetX - pivotX);
    const restAngle = Math.PI / 2; // Pointing straight down (90 degrees)

    return { playingAngle, restAngle, pivotX, pivotY };
  }, [canvasSize, outerBorderWidth]);

  // Initialize tonearm to rest position
  useEffect(() => {
    if (tonearmAngle === null) {
      const { restAngle } = getTonearmAngles();
      setTonearmAngle(restAngle);
    }
  }, [canvasSize, getTonearmAngles, tonearmAngle]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Scale canvas for high-DPI displays
    // Add extra space for tonearm (30% extra on right side)
    const tonearmPadding = canvasSize * 0.30;
    const canvasWidth = canvasSize + tonearmPadding;
    const canvasHeight = canvasSize;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    ctx.scale(dpr, dpr);

    const drawWheel = () => {
      // Wheel is centered in the left portion, leaving room for tonearm
      const centerX = canvasSize / 2;
      const centerY = canvasSize / 2;
      const scale = canvasSize / 600; // Scale factor for responsive sizing
      const scaledBorderWidth = outerBorderWidth * scale;
      const radius = Math.min(centerX, centerY) - scaledBorderWidth - 10 * scale;
      const numSegments = data.length;
      const arcSize = (2 * Math.PI) / numSegments;

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      // Draw glow effect when spinning
      if (glowIntensity > 0) {
        ctx.save();
        ctx.shadowColor = '#f9dd50';
        ctx.shadowBlur = 30 * glowIntensity * scale;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 5 * scale, 0, 2 * Math.PI);
        ctx.fillStyle = 'transparent';
        ctx.fill();
        ctx.restore();
      }

      // Draw vinyl record base (black vinyl)
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation);
      ctx.translate(-centerX, -centerY);

      // Outer vinyl edge with glossy effect
      const vinylGradient = ctx.createRadialGradient(
        centerX - 50 * scale, centerY - 50 * scale, 0,
        centerX, centerY, radius + 15 * scale
      );
      vinylGradient.addColorStop(0, '#3a3a3a');
      vinylGradient.addColorStop(0.5, '#1a1a1a');
      vinylGradient.addColorStop(1, '#0a0a0a');

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 10 * scale, 0, 2 * Math.PI);
      ctx.fillStyle = vinylGradient;
      ctx.fill();

      // Draw vinyl grooves
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 0.5 * scale;
      const grooveStart = 60 * scale;
      const grooveSpacing = 3 * scale;
      for (let r = grooveStart; r < radius + 5 * scale; r += grooveSpacing) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, 2 * Math.PI);
        ctx.stroke();
      }

      // Draw colored segments (the "label" area, but extending further)
      data.forEach((item, index) => {
        const angle = index * arcSize;

        // Draw segment
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius - 5 * scale, angle, angle + arcSize);
        ctx.closePath();

        // Create gradient for each segment
        const segmentColor = backgroundColors[index % backgroundColors.length];
        const gradient = ctx.createRadialGradient(
          centerX, centerY, 0,
          centerX, centerY, radius
        );
        gradient.addColorStop(0, lightenColor(segmentColor, 30));
        gradient.addColorStop(0.3, segmentColor);
        gradient.addColorStop(1, darkenColor(segmentColor, 20));

        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw segment dividers
        if (radiusLineWidth > 0) {
          ctx.strokeStyle = radiusLineColor;
          ctx.lineWidth = radiusLineWidth * scale;
          ctx.stroke();
        }

        // Draw text with shadow for better readability
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(angle + arcSize / 2);
        ctx.textAlign = 'right';

        // Text shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 3 * scale;
        ctx.shadowOffsetX = 1 * scale;
        ctx.shadowOffsetY = 1 * scale;

        ctx.fillStyle = textColors[index % textColors.length];
        const scaledFontSize = fontSize * scale;
        ctx.font = `bold ${scaledFontSize}px 'Segoe UI', Arial, sans-serif`;

        const text = item.option;
        const dist = (radius * textDistance) / 100;

        if (perpendicularText) {
          ctx.fillText(text, dist, 0);
        } else {
          ctx.fillText(text, dist, scaledFontSize / 3);
        }

        ctx.restore();
      });

      ctx.restore();

      // Draw outer border with metallic effect
      if (outerBorderWidth > 0) {
        const borderGradient = ctx.createLinearGradient(
          centerX - radius, centerY - radius,
          centerX + radius, centerY + radius
        );
        borderGradient.addColorStop(0, '#4a4a4a');
        borderGradient.addColorStop(0.3, '#2a2a2a');
        borderGradient.addColorStop(0.5, '#5a5a5a');
        borderGradient.addColorStop(0.7, '#2a2a2a');
        borderGradient.addColorStop(1, '#4a4a4a');

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 10 * scale, 0, 2 * Math.PI);
        ctx.lineWidth = (scaledBorderWidth + 8 * scale);
        ctx.strokeStyle = borderGradient;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 10 * scale, 0, 2 * Math.PI);
        ctx.lineWidth = scaledBorderWidth;
        ctx.strokeStyle = outerBorderColor;
        ctx.stroke();
      }

      // Draw center spindle (vinyl center hole with metallic look)
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation);
      ctx.translate(-centerX, -centerY);

      // Outer spindle ring
      const spindleSize = 25 * scale;
      const spindleGradient = ctx.createRadialGradient(
        centerX - 5 * scale, centerY - 5 * scale, 0,
        centerX, centerY, spindleSize
      );
      spindleGradient.addColorStop(0, '#888');
      spindleGradient.addColorStop(0.5, '#444');
      spindleGradient.addColorStop(1, '#222');

      ctx.beginPath();
      ctx.arc(centerX, centerY, spindleSize, 0, 2 * Math.PI);
      ctx.fillStyle = spindleGradient;
      ctx.fill();

      // Inner hole
      ctx.beginPath();
      ctx.arc(centerX, centerY, 8 * scale, 0, 2 * Math.PI);
      ctx.fillStyle = '#1a1a1a';
      ctx.fill();

      ctx.restore();

      // Draw Tonearm
      ctx.save();

      // Get tonearm position from helper (pivot at 2 o'clock, target at 5 o'clock)
      const { playingAngle, pivotX, pivotY } = getTonearmAngles();
      const armAngle = tonearmAngle !== null ? tonearmAngle : playingAngle;

      // Calculate target position for arm length (5 o'clock on record)
      const targetAngle = Math.PI / 6;
      const targetX = centerX + Math.cos(targetAngle) * (radius - 20 * scale);
      const targetY = centerY + Math.sin(targetAngle) * (radius - 20 * scale);

      // Tonearm shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 15 * scale;
      ctx.shadowOffsetX = 3 * scale;
      ctx.shadowOffsetY = 5 * scale;

      // Tonearm base/pivot housing
      const baseGradient = ctx.createRadialGradient(
        pivotX - 5 * scale, pivotY - 5 * scale, 0,
        pivotX, pivotY, 25 * scale
      );
      baseGradient.addColorStop(0, '#666');
      baseGradient.addColorStop(0.5, '#444');
      baseGradient.addColorStop(1, '#222');

      ctx.beginPath();
      ctx.arc(pivotX, pivotY, 22 * scale, 0, 2 * Math.PI);
      ctx.fillStyle = baseGradient;
      ctx.fill();

      // Pivot center detail
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, 8 * scale, 0, 2 * Math.PI);
      ctx.fillStyle = '#1a1a1a';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, 4 * scale, 0, 2 * Math.PI);
      ctx.fillStyle = '#c0392b';
      ctx.fill();

      // Arm length
      const armLength = Math.sqrt(Math.pow(targetX - pivotX, 2) + Math.pow(targetY - pivotY, 2));

      ctx.save();
      ctx.translate(pivotX, pivotY);
      ctx.rotate(armAngle);

      // Main tonearm body
      const armGradient = ctx.createLinearGradient(0, -4 * scale, 0, 4 * scale);
      armGradient.addColorStop(0, '#888');
      armGradient.addColorStop(0.3, '#ccc');
      armGradient.addColorStop(0.5, '#aaa');
      armGradient.addColorStop(0.7, '#888');
      armGradient.addColorStop(1, '#555');

      // Draw arm as a tapered shape
      ctx.beginPath();
      ctx.moveTo(15 * scale, -5 * scale);
      ctx.lineTo(armLength - 20 * scale, -3 * scale);
      ctx.lineTo(armLength - 20 * scale, 3 * scale);
      ctx.lineTo(15 * scale, 5 * scale);
      ctx.closePath();
      ctx.fillStyle = armGradient;
      ctx.fill();

      // Headshell (cartridge holder)
      const headshellX = armLength - 20 * scale;
      ctx.beginPath();
      ctx.moveTo(headshellX, -4 * scale);
      ctx.lineTo(headshellX + 25 * scale, -6 * scale);
      ctx.lineTo(headshellX + 30 * scale, -3 * scale);
      ctx.lineTo(headshellX + 30 * scale, 3 * scale);
      ctx.lineTo(headshellX + 25 * scale, 6 * scale);
      ctx.lineTo(headshellX, 4 * scale);
      ctx.closePath();
      ctx.fillStyle = '#333';
      ctx.fill();

      // Cartridge body
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(headshellX + 8 * scale, -4 * scale, 15 * scale, 8 * scale);

      // Stylus/needle
      ctx.beginPath();
      ctx.moveTo(headshellX + 28 * scale, 0);
      ctx.lineTo(headshellX + 35 * scale, 8 * scale);
      ctx.lineTo(headshellX + 32 * scale, 8 * scale);
      ctx.lineTo(headshellX + 26 * scale, 2 * scale);
      ctx.closePath();
      ctx.fillStyle = '#c0392b';
      ctx.fill();

      // Stylus tip highlight
      ctx.beginPath();
      ctx.arc(headshellX + 33 * scale, 8 * scale, 2 * scale, 0, 2 * Math.PI);
      ctx.fillStyle = '#e74c3c';
      ctx.fill();

      ctx.restore();
      ctx.restore();

      // Draw confetti
      confetti.forEach(p => {
        ctx.save();
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
      });
    };

    drawWheel();
  }, [
    data,
    backgroundColors,
    textColors,
    outerBorderColor,
    outerBorderWidth,
    radiusLineColor,
    radiusLineWidth,
    fontSize,
    textDistance,
    perpendicularText,
    innerBorderColor,
    rotation,
    glowIntensity,
    confetti,
    canvasSize,
    dpr,
    tonearmAngle,
    getTonearmAngles
  ]);

  // Helper functions for color manipulation
  const lightenColor = (color: string, percent: number): string => {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  };

  const darkenColor = (color: string, percent: number): string => {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  };

  useEffect(() => {
    if (mustStartSpinning && !isSpinning.current && data.length > 0) {
      isSpinning.current = true;
      startTime.current = performance.now();
      startRotation.current = rotation;
      lastTickAngle.current = rotation;

      // Animate tonearm from rest to playing position
      if (!tonearmAnimating.current) {
        tonearmAnimating.current = true;
        tonearmStartTime.current = performance.now();
        const { playingAngle, restAngle } = getTonearmAngles();

        const animateTonearm = (currentTime: number) => {
          const elapsed = (currentTime - tonearmStartTime.current) / 1000;
          const duration = 0.6; // 600ms for tonearm to reach record

          if (elapsed < duration) {
            const t = elapsed / duration;
            const easeOut = 1 - Math.pow(1 - t, 3); // Cubic ease-out
            const currentAngle = restAngle + (playingAngle - restAngle) * easeOut;
            setTonearmAngle(currentAngle);
            requestAnimationFrame(animateTonearm);
          } else {
            setTonearmAngle(playingAngle);
            tonearmAnimating.current = false;
          }
        };
        requestAnimationFrame(animateTonearm);
      }

      const numSegments = data.length;
      const arcSize = (2 * Math.PI) / numSegments;

      // More spins for dramatic effect (4 to 7 full rotations)
      const extraSpins = (4 + Math.random() * 3) * 2 * Math.PI;

      // Target angle for the center of the winning segment
      // Needle points at 5 o'clock position (π/6 radians = 30 degrees below horizontal right)
      const needleAngle = Math.PI / 6;
      const winningSegmentAngle = prizeNumber * arcSize + arcSize / 2;

      let targetRotation = needleAngle - winningSegmentAngle;

      // Make target larger than current
      while (targetRotation < startRotation.current + extraSpins) {
        targetRotation += 2 * Math.PI;
      }

      totalRotation.current = targetRotation;

      // Calculate duration based on spin amount (longer spin = longer duration)
      const actualDuration = spinDuration + 2 + Math.random() * 1;

      const animate = (currentTime: number) => {
        if (!isSpinning.current) return;

        const elapsed = (currentTime - startTime.current) / 1000;

        if (elapsed < actualDuration) {
          // Improved easing: combination of ease-out-quint for smooth deceleration
          const t = elapsed / actualDuration;
          const easeOut = 1 - Math.pow(1 - t, 5); // Quint easing for more natural slowdown

          const currentRot = startRotation.current + (totalRotation.current - startRotation.current) * easeOut;
          setRotation(currentRot);

          // Update glow intensity (peaks in middle, fades at end)
          const glowT = t < 0.5 ? t * 2 : 2 - t * 2;
          setGlowIntensity(glowT * 0.8);

          // Play tick sound when crossing segment boundaries
          if (enableSound) {
            const rotationDelta = currentRot - lastTickAngle.current;
            if (rotationDelta >= arcSize * 0.8) {
              playTickSound();
              lastTickAngle.current = currentRot;
            }
          }

          requestAnimationFrame(animate);
        } else {
          setRotation(totalRotation.current);
          setGlowIntensity(0);
          isSpinning.current = false;

          // Play win sound and spawn confetti
          if (enableSound) {
            playWinSound();
          }
          spawnConfetti();

          if (onStopSpinning) onStopSpinning();
        }
      };

      requestAnimationFrame(animate);
    }
  }, [mustStartSpinning, prizeNumber, data.length, spinDuration, onStopSpinning, rotation, enableSound, spawnConfetti, getTonearmAngles]);

  // Animate tonearm back to rest position when resetTonearm becomes true
  useEffect(() => {
    if (resetTonearm && !tonearmAnimating.current) {
      const { playingAngle, restAngle } = getTonearmAngles();
      tonearmAnimating.current = true;
      tonearmStartTime.current = performance.now();

      const animateBack = (currentTime: number) => {
        const elapsed = (currentTime - tonearmStartTime.current) / 1000;
        const duration = 0.5; // 500ms to lift arm

        if (elapsed < duration) {
          const t = elapsed / duration;
          const easeOut = 1 - Math.pow(1 - t, 2); // Quadratic ease-out
          const currentAngle = playingAngle + (restAngle - playingAngle) * easeOut;
          setTonearmAngle(currentAngle);
          requestAnimationFrame(animateBack);
        } else {
          setTonearmAngle(restAngle);
          tonearmAnimating.current = false;
        }
      };
      requestAnimationFrame(animateBack);
    }
  }, [resetTonearm, getTonearmAngles]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: `${canvasSize * 1.30}px`,
          height: `${canvasSize}px`,
          maxWidth: '100%',
          maxHeight: '100%',
          touchAction: 'manipulation' // Prevent zoom on double-tap
        }}
      />
    </div>
  );
};

export default RouletteWheel;

