import { useEffect, useRef, useState, useCallback } from 'react';

interface WheelData {
  option: string;
  style?: { backgroundColor?: string; textColor?: string };
}

interface RouletteWheelProps {
  mustStartSpinning: boolean;
  prizeNumber: number;
  data: WheelData[];
  isRouletteMode?: boolean; // true = roulette spin (ends and selects), false = cosmetic (continuous)
  onRouletteComplete?: () => void; // Callback when roulette spin completes
  backgroundColors?: string[];
  textColors?: string[];
  outerBorderColor?: string;
  outerBorderWidth?: number;
  innerBorderColor?: string;
  radiusLineColor?: string;
  radiusLineWidth?: number;
  fontSize?: number;
  textDistance?: number;
  perpendicularText?: boolean;
  shouldStop?: boolean; // When true, gradually stops the spin (cosmetic mode)
  onStopComplete?: (stoppedIndex: number) => void; // Callback when manual stop completes with segment index
  resetTonearm?: boolean; // When true, animates tonearm back to rest position
  spinSpeed?: '33' | '45'; // Current speed setting
  onSpeedToggle?: () => void; // Callback when speed button clicked
  onStopClick?: () => void; // Callback when stop button clicked
  onStartClick?: () => void; // Callback when start button clicked
  onWheelClick?: () => void; // Callback when wheel (not buttons) is clicked
  filterTransition?: boolean; // When true, triggers a small spin animation
}

const RouletteWheel = ({
  mustStartSpinning,
  prizeNumber,
  data,
  isRouletteMode = false,
  onRouletteComplete,
  shouldStop = false,
  onStopComplete,
  backgroundColors = ['darkgrey'],
  textColors = ['white'],
  outerBorderColor = 'black',
  outerBorderWidth = 5,
  innerBorderColor = 'black',
  radiusLineColor = 'black',
  radiusLineWidth = 5,
  fontSize = 20,
  textDistance = 60,
  perpendicularText = false,
  resetTonearm = false,
  spinSpeed = '33',
  onSpeedToggle,
  onStopClick,
  onStartClick,
  onWheelClick,
  filterTransition = false,
}: RouletteWheelProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(0);
  const [canvasSize, setCanvasSize] = useState(600);
  const [dpr, setDpr] = useState(1);

  // Animation state
  const isSpinning = useRef(false);
  const startRotation = useRef(0);
  const startTime = useRef(0);

  // Tonearm animation state
  const [tonearmAngle, setTonearmAngle] = useState<number | null>(null);
  const tonearmAnimating = useRef(false);
  const tonearmStartTime = useRef(0);
  const tonearmDownTriggered = useRef(false); // Track if tonearm down animation has been triggered for this spin

  // Stop animation state
  const isStoppingManually = useRef(false);
  const stopStartTime = useRef(0);
  const shouldStopRef = useRef(shouldStop);

  // Button state and positions
  const [pressedButton, setPressedButton] = useState<string | null>(null);
  const buttonPositions = useRef<{
    speed: { x: number; y: number; radius: number };
    stop: { x: number; y: number; radius: number };
    start: { x: number; y: number; radius: number };
  } | null>(null);

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

  // Calculate tonearm rest and playing angles
  const getTonearmAngles = useCallback(() => {
    const scale = canvasSize / 600;
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;
    const scaledBorderWidth = outerBorderWidth * scale;
    const radius = Math.min(centerX, centerY) - scaledBorderWidth - 10 * scale;

    // Pivot positioned to the right of the wheel (in the extra canvas space)
    const pivotX = canvasSize + 40 * scale; // In the 30% extra space on the right
    const pivotY = centerY - radius * 0.60; // Shifted up 10% more

    // Target at 5 o'clock position (on the record edge)
    const targetAngle = Math.PI / 6; // 5 o'clock = 30 degrees below horizontal
    const targetX = centerX + Math.cos(targetAngle) * (radius - 20 * scale);
    const targetY = centerY + Math.sin(targetAngle) * (radius - 20 * scale);

    const playingAngle = Math.atan2(targetY - pivotY, targetX - pivotX);
    const restAngle = Math.PI / 2; // Pointing straight down (90 degrees)

    return { playingAngle, restAngle, pivotX, pivotY };
  }, [canvasSize, outerBorderWidth]);

  // Draw realistic 3D button
  const drawButton = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    label: string,
    color: string,
    isPressed: boolean,
    isDisabled: boolean,
    scale: number,
    topLabel?: string
  ) => {
    ctx.save();

    // Button disabled state
    const alpha = isDisabled ? 0.4 : 1.0;

    // Draw shadow
    if (!isPressed) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 8 * scale;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 4 * scale;
    }

    // Main button circle
    ctx.beginPath();
    ctx.arc(x, y + (isPressed ? 2 * scale : 0), radius, 0, 2 * Math.PI);

    // Gradient for 3D effect
    const gradient = ctx.createRadialGradient(
      x - radius * 0.3,
      y - radius * 0.3 + (isPressed ? 2 * scale : 0),
      radius * 0.1,
      x,
      y + (isPressed ? 2 * scale : 0),
      radius
    );

    if (isPressed) {
      gradient.addColorStop(0, color);
      gradient.addColorStop(0.6, lightenColor(color, -15));
      gradient.addColorStop(1, lightenColor(color, -30));
    } else {
      gradient.addColorStop(0, lightenColor(color, 20));
      gradient.addColorStop(0.6, color);
      gradient.addColorStop(1, lightenColor(color, -20));
    }

    ctx.globalAlpha = alpha;
    ctx.fillStyle = gradient;
    ctx.fill();

    // Inner rim highlight
    if (!isPressed) {
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.9, 0, Math.PI * 1.5);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2 * scale;
      ctx.stroke();
    }

    // Outer rim shadow
    ctx.beginPath();
    ctx.arc(x, y + (isPressed ? 2 * scale : 0), radius, Math.PI * 0.2, Math.PI * 1.2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 2 * scale;
    ctx.stroke();

    ctx.restore();

    // Top label (for speed: "33 45")
    if (topLabel) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#cccccc';
      ctx.font = `bold ${10 * scale}px 'Arial', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(topLabel, x, y - radius - 8 * scale);
      ctx.restore();
    }

    // Bottom label
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#cccccc';
    ctx.font = `bold ${11 * scale}px 'Arial', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, x, y + radius + 6 * scale);
    ctx.restore();
  }, []);

  // Helper function to lighten colors for button gradients
  const lightenColor = (color: string, percent: number): string => {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, Math.max(0, (num >> 16) + amt));
    const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
    const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  };

  // Keep shouldStopRef in sync with prop
  useEffect(() => {
    shouldStopRef.current = shouldStop;
  }, [shouldStop]);

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
    // Add extra space for tonearm (30% extra on right side, 15% on top)
    const tonearmPaddingRight = canvasSize * 0.30;
    const tonearmPaddingTop = canvasSize * 0.15;
    const canvasWidth = canvasSize + tonearmPaddingRight;
    const canvasHeight = canvasSize + tonearmPaddingTop;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    ctx.scale(dpr, dpr);

    const drawWheel = () => {
      // Wheel is centered in the left portion, with offset for top padding
      const centerX = canvasSize / 2;
      const centerY = canvasSize / 2 + tonearmPaddingTop;
      const scale = canvasSize / 600; // Scale factor for responsive sizing
      const scaledBorderWidth = outerBorderWidth * scale;
      const radius = Math.min(centerX, centerY) - scaledBorderWidth - 10 * scale;
      const numSegments = data.length;
      const arcSize = (2 * Math.PI) / numSegments;

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      // Draw vinyl record base (black vinyl)
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation);
      ctx.translate(-centerX, -centerY);



      // Draw colored segments (stopping at the label edge)
      const labelRadius = 80 * scale;
      data.forEach((item, index) => {
        const angle = index * arcSize;

        // Draw segment as a ring (from label edge to outer edge)
        ctx.beginPath();
        ctx.arc(centerX, centerY, labelRadius, angle, angle + arcSize);
        ctx.arc(centerX, centerY, radius - 5 * scale, angle + arcSize, angle, true);
        ctx.closePath();

        // Fill with solid segment color (darkened and desaturated)
        const baseColor = backgroundColors[index % backgroundColors.length];
        const segmentColor = darkenAndDesaturateColor(baseColor, 20, 0.3);
        ctx.fillStyle = segmentColor;
        ctx.fill();

        // Add texture overlay: vinyl grooves
        ctx.save();
        ctx.clip(); // Clip to segment shape

        // Add padding from inner and outer edges
        const texturePadding = 25 * scale;
        const textureInnerRadius = labelRadius + texturePadding;
        const textureOuterRadius = radius - 15 * scale - texturePadding;

        // Draw concentric circular grooves with track gaps
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.lineWidth = 0.8 * scale;
        const grooveSpacing = 3 * scale; // Tighter grooves within a track
        const trackGap = 12 * scale; // Larger gap between tracks
        const groovesPerTrack = 5; // Number of grooves per track section

        let r = textureInnerRadius;
        while (r < textureOuterRadius) {
          // Draw a group of close grooves (one track)
          for (let i = 0; i < groovesPerTrack && r < textureOuterRadius; i++) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, r, angle, angle + arcSize);
            ctx.stroke();
            r += grooveSpacing;
          }
          // Add larger gap for track separation
          r += trackGap;
        }

        // Add subtle radial lines for depth
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.03)';
        ctx.lineWidth = 0.5 * scale;
        const numRadialLines = 20;
        for (let i = 0; i < numRadialLines; i++) {
          const lineAngle = angle + (arcSize * i) / numRadialLines;
          ctx.beginPath();
          ctx.moveTo(
            centerX + Math.cos(lineAngle) * textureInnerRadius,
            centerY + Math.sin(lineAngle) * textureInnerRadius
          );
          ctx.lineTo(
            centerX + Math.cos(lineAngle) * textureOuterRadius,
            centerY + Math.sin(lineAngle) * textureOuterRadius
          );
          ctx.stroke();
        }

        // Add subtle gradient overlay for dimension
        const overlayGradient = ctx.createRadialGradient(
          centerX, centerY, labelRadius,
          centerX, centerY, radius
        );
        overlayGradient.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
        overlayGradient.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
        overlayGradient.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
        ctx.fillStyle = overlayGradient;
        ctx.fill();

        ctx.restore();

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

      // Draw center label with zoetrope spiral pattern (rotates with wheel)
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation);

      // Black background with white border
      ctx.beginPath();
      ctx.arc(0, 0, labelRadius, 0, 2 * Math.PI);
      ctx.fillStyle = '#0a0a0a';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 * scale;
      ctx.stroke();

      // Draw multiple Archimedean spirals for zoetrope effect
      const numSpirals = 2;
      const spiralTurns = 2.5;
      const angleOffset = (2 * Math.PI) / numSpirals;

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3 * scale;
      ctx.lineCap = 'round';

      for (let s = 0; s < numSpirals; s++) {
        ctx.beginPath();
        const startAngle = s * angleOffset;

        for (let t = 0; t <= spiralTurns * 2 * Math.PI; t += 0.1) {
          const r = (labelRadius * t) / (spiralTurns * 2 * Math.PI);
          const angle = startAngle + t;
          const x = r * Math.cos(angle);
          const y = r * Math.sin(angle);

          if (t === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      ctx.translate(-centerX, -centerY);
      ctx.restore();

      // Draw center spindle hole (small silver circle - innermost)
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation);
      ctx.translate(-centerX, -centerY);

      const spindleHoleRadius = 12 * scale;
      ctx.beginPath();
      ctx.arc(centerX, centerY, spindleHoleRadius, 0, 2 * Math.PI);
      ctx.fillStyle = '#c0c0c0';
      ctx.fill();

      ctx.restore();

      // Draw Tonearm (realistic style based on Audio-Technica)
      ctx.save();

      // Get tonearm position from helper (pivot at 2 o'clock, target at 5 o'clock)
      const { playingAngle, pivotX, pivotY } = getTonearmAngles();
      const armAngle = tonearmAngle !== null ? tonearmAngle : playingAngle;

      // Calculate target position for arm length (5 o'clock on record)
      const targetAngle = Math.PI / 6;
      const targetX = centerX + Math.cos(targetAngle) * (radius - 20 * scale);
      const targetY = centerY + Math.sin(targetAngle) * (radius - 20 * scale);

      // Tonearm shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 20 * scale;
      ctx.shadowOffsetX = 4 * scale;
      ctx.shadowOffsetY = 6 * scale;

      // Arm length
      const armLength = Math.sqrt(Math.pow(targetX - pivotX, 2) + Math.pow(targetY - pivotY, 2));

      ctx.save();
      ctx.translate(pivotX, pivotY);
      ctx.rotate(armAngle);

      // Tonearm base/pivot housing (more substantial) - bigger
      ctx.beginPath();
      ctx.arc(0, 0, 50 * scale, 0, 2 * Math.PI);
      ctx.fillStyle = '#1a1a1a';
      ctx.fill();

      // Outer ring on base
      ctx.beginPath();
      ctx.arc(0, 0, 36 * scale, 0, 2 * Math.PI);
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 4 * scale;
      ctx.stroke();

      // Pivot center (metallic)
      ctx.beginPath();
      ctx.arc(0, 0, 14 * scale, 0, 2 * Math.PI);
      ctx.fillStyle = '#666';
      ctx.fill();

      // Main tonearm body (black, straight) - thicker
      const armThickness = 9 * scale;
      ctx.beginPath();
      ctx.moveTo(15 * scale, -armThickness);
      ctx.lineTo(armLength - 25 * scale, -armThickness);
      ctx.lineTo(armLength - 25 * scale, armThickness);
      ctx.lineTo(15 * scale, armThickness);
      ctx.closePath();
      ctx.fillStyle = '#1a1a1a';
      ctx.fill();

      // Counterweight at the back (behind pivot) - bigger
      ctx.beginPath();
      ctx.arc(-45 * scale, 0, 20 * scale, 0, 2 * Math.PI);
      ctx.fillStyle = '#2a2a2a';
      ctx.fill();

      // Counterweight center ring detail
      ctx.beginPath();
      ctx.arc(-45 * scale, 0, 8 * scale, 0, 2 * Math.PI);
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1.5 * scale;
      ctx.stroke();

      // Arm highlight (subtle)
      ctx.beginPath();
      ctx.moveTo(15 * scale, -armThickness + 1 * scale);
      ctx.lineTo(armLength - 25 * scale, -armThickness + 1 * scale);
      ctx.lineTo(armLength - 25 * scale, -armThickness + 2 * scale);
      ctx.lineTo(15 * scale, -armThickness + 2 * scale);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fill();

      // Headshell (angular, realistic) - bigger
      const headshellX = armLength - 30 * scale;
      ctx.beginPath();
      ctx.moveTo(headshellX, -armThickness);
      ctx.lineTo(headshellX + 45 * scale, -12 * scale);
      ctx.lineTo(headshellX + 52 * scale, -8 * scale);
      ctx.lineTo(headshellX + 52 * scale, 8 * scale);
      ctx.lineTo(headshellX + 45 * scale, 12 * scale);
      ctx.lineTo(headshellX, armThickness);
      ctx.closePath();
      ctx.fillStyle = '#1a1a1a';
      ctx.fill();

      // Headshell side detail (silver accent)
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1.5 * scale;
      ctx.stroke();

      // Cartridge body (black rectangular) - bigger
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(headshellX + 14 * scale, -7 * scale, 26 * scale, 14 * scale);

      // Cartridge wires (tiny colored dots)
      const wireColors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f'];
      wireColors.forEach((color, i) => {
        ctx.beginPath();
        ctx.arc(headshellX + 20 * scale + i * 4 * scale, -4 * scale, 1.2 * scale, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
      });

      // Tonearm lifter integrated with cartridge
      // Lifter arm (vertical part) - thicker and lower
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(headshellX + 8 * scale, -34 * scale, 5 * scale, 24 * scale);

      // Lifter arm outline (gray)
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1.5 * scale;
      ctx.strokeRect(headshellX + 8 * scale, -34 * scale, 5 * scale, 24 * scale);


      // Stylus/needle (red) - bigger
      ctx.beginPath();
      ctx.moveTo(headshellX + 45 * scale, 0);
      ctx.lineTo(headshellX + 55 * scale, 13 * scale);
      ctx.lineTo(headshellX + 51 * scale, 13 * scale);
      ctx.lineTo(headshellX + 43 * scale, 2 * scale);
      ctx.closePath();
      ctx.fillStyle = '#c0392b';
      ctx.fill();

      // Stylus tip (bright red dot) - bigger
      ctx.beginPath();
      ctx.arc(headshellX + 52 * scale, 13 * scale, 2.5 * scale, 0, 2 * Math.PI);
      ctx.fillStyle = '#e74c3c';
      ctx.fill();

      ctx.restore();
      ctx.restore();

      // Draw control buttons at bottom right (in the tonearm area)
      const buttonRadius = 18 * scale; // Smaller buttons
      const buttonY = canvasHeight - 60 * scale; // Position near bottom
      const buttonSpacing = 65 * scale; // Closer spacing for smaller buttons
      const rightEdge = canvasWidth - 40 * scale; // Far right edge with padding

      // Button positions (right to left: START, STOP, SPEED)
      const startButtonX = rightEdge;
      const stopButtonX = rightEdge - buttonSpacing;
      const speedButtonX = rightEdge - buttonSpacing * 2;

      // Store button positions for hit testing
      buttonPositions.current = {
        speed: { x: speedButtonX, y: buttonY, radius: buttonRadius },
        stop: { x: stopButtonX, y: buttonY, radius: buttonRadius },
        start: { x: startButtonX, y: buttonY, radius: buttonRadius }
      };

      // Draw SPEED button (black) - pressed when 45 RPM
      drawButton(
        ctx,
        speedButtonX,
        buttonY,
        buttonRadius,
        'SPEED',
        '#3a3a3a', // Black like other buttons
        spinSpeed === '45',
        isSpinning.current,
        scale
      );

      // Draw RPM labels and indicator lights above speed button
      const labelY = buttonY - buttonRadius - 18 * scale;
      const indicatorY = labelY + 10 * scale;
      const labelSpacing = 14 * scale;
      const indicatorWidth = 8 * scale;
      const indicatorHeight = 4 * scale;
      const alpha = isSpinning.current ? 0.4 : 1.0;

      // "33" label
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#cccccc';
      ctx.font = `bold ${10 * scale}px 'Arial', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('33', speedButtonX - labelSpacing, labelY);
      ctx.restore();

      // 33 indicator light below label (orange when active)
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.roundRect(speedButtonX - labelSpacing - indicatorWidth / 2, indicatorY, indicatorWidth, indicatorHeight, 2 * scale);
      if (spinSpeed === '33') {
        ctx.fillStyle = '#ff8f43';
        ctx.shadowColor = '#ff8f43';
        ctx.shadowBlur = 6 * scale;
      } else {
        ctx.fillStyle = '#333333';
        ctx.shadowBlur = 0;
      }
      ctx.fill();
      ctx.restore();

      // "45" label
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#cccccc';
      ctx.font = `bold ${10 * scale}px 'Arial', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('45', speedButtonX + labelSpacing, labelY);
      ctx.restore();

      // 45 indicator light below label (orange when active)
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.roundRect(speedButtonX + labelSpacing - indicatorWidth / 2, indicatorY, indicatorWidth, indicatorHeight, 2 * scale);
      if (spinSpeed === '45') {
        ctx.fillStyle = '#ff8f43';
        ctx.shadowColor = '#ff8f43';
        ctx.shadowBlur = 6 * scale;
      } else {
        ctx.fillStyle = '#333333';
        ctx.shadowBlur = 0;
      }
      ctx.fill();
      ctx.restore();

      // Draw STOP button (dark grey)
      drawButton(
        ctx,
        stopButtonX,
        buttonY,
        buttonRadius,
        'STOP',
        '#3a3a3a',
        pressedButton === 'stop',
        !isSpinning.current || isStoppingManually.current,
        scale
      );

      // Draw START button (dark grey)
      drawButton(
        ctx,
        startButtonX,
        buttonY,
        buttonRadius,
        'START',
        '#3a3a3a',
        pressedButton === 'start',
        isSpinning.current,
        scale
      );

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
    canvasSize,
    dpr,
    tonearmAngle,
    getTonearmAngles,
    pressedButton,
    drawButton,
    mustStartSpinning,
    spinSpeed
  ]);

  // Helper function for color manipulation
  const darkenAndDesaturateColor = (color: string, darkenPercent: number, desaturateAmount: number): string => {
    const num = parseInt(color.replace('#', ''), 16);
    let R = (num >> 16);
    let G = (num >> 8) & 0x00FF;
    let B = num & 0x0000FF;

    // Desaturate by blending with gray
    const gray = (R + G + B) / 3;
    R = R + (gray - R) * desaturateAmount;
    G = G + (gray - G) * desaturateAmount;
    B = B + (gray - B) * desaturateAmount;

    // Darken
    const amt = Math.round(2.55 * darkenPercent);
    R = Math.max(0, R - amt);
    G = Math.max(0, G - amt);
    B = Math.max(0, B - amt);

    return `#${(0x1000000 + Math.round(R) * 0x10000 + Math.round(G) * 0x100 + Math.round(B)).toString(16).slice(1)}`;
  };

  // Store current speed in a ref for the animation loop
  const spinSpeedRef = useRef(spinSpeed);
  useEffect(() => {
    spinSpeedRef.current = spinSpeed;
  }, [spinSpeed]);

  // Store isRouletteMode in ref for animation access
  const isRouletteModeRef = useRef(isRouletteMode);
  useEffect(() => {
    isRouletteModeRef.current = isRouletteMode;
  }, [isRouletteMode]);

  // Spinning animation - handles both roulette and cosmetic modes
  useEffect(() => {
    if (mustStartSpinning && !isSpinning.current && data.length > 0) {
      isSpinning.current = true;
      startTime.current = performance.now();
      startRotation.current = rotation;
      tonearmDownTriggered.current = false;

      // Calculate target rotation for roulette mode
      let targetRotation = 0;
      let spinDuration = 4; // seconds for roulette spin
      if (isRouletteModeRef.current) {
        const numSegments = data.length;
        const arcSize = (2 * Math.PI) / numSegments;
        const needleAngle = Math.PI / 6; // 5 o'clock
        const winningSegmentAngle = prizeNumber * arcSize + arcSize / 2;
        const extraSpins = (3 + Math.random() * 2) * 2 * Math.PI;
        targetRotation = needleAngle - winningSegmentAngle;
        while (targetRotation < startRotation.current + extraSpins) {
          targetRotation += 2 * Math.PI;
        }
        spinDuration = 4 + Math.random() * 1;
      }

      // Animate tonearm down to playing position
      if (!tonearmAnimating.current) {
        tonearmAnimating.current = true;
        tonearmStartTime.current = performance.now();
        const angles = getTonearmAngles();
        const startAngle = angles.restAngle;
        const endAngle = angles.playingAngle;

        const animateTonearmDown = (currentTime: number) => {
          const downElapsed = (currentTime - tonearmStartTime.current) / 1000;
          const downDuration = 1.5;

          if (downElapsed < downDuration) {
            const t = downElapsed / downDuration;
            const easeOut = 1 - Math.pow(1 - t, 3);
            setTonearmAngle(startAngle + (endAngle - startAngle) * easeOut);
            requestAnimationFrame(animateTonearmDown);
          } else {
            setTonearmAngle(endAngle);
            tonearmAnimating.current = false;
          }
        };
        requestAnimationFrame(animateTonearmDown);
      }

      let lastTime = performance.now();

      const animate = (currentTime: number) => {
        if (!isSpinning.current) return;

        const elapsed = (currentTime - startTime.current) / 1000;

        // ROULETTE MODE: Spin to target and stop
        if (isRouletteModeRef.current) {
          if (elapsed < spinDuration) {
            const t = elapsed / spinDuration;
            const easeInOut = t < 0.5
              ? 4 * t * t * t
              : 1 - Math.pow(-2 * t + 2, 3) / 2;
            const currentRot = startRotation.current + (targetRotation - startRotation.current) * easeInOut;
            setRotation(currentRot);
            requestAnimationFrame(animate);
          } else {
            setRotation(targetRotation);
            isSpinning.current = false;
            if (onRouletteComplete) onRouletteComplete();
          }
          return;
        }

        // COSMETIC MODE: Continuous spin until stop
        // Check for stop trigger
        if (shouldStopRef.current && !isStoppingManually.current) {
          isStoppingManually.current = true;
          stopStartTime.current = currentTime;
        }

        // Handle gradual stop
        if (isStoppingManually.current) {
          const stopElapsed = (currentTime - stopStartTime.current) / 1000;
          const stopDuration = 2.0;

          if (stopElapsed < stopDuration) {
            const t = stopElapsed / stopDuration;
            const easeOut = 1 - Math.pow(1 - t, 2);
            const currentSpeed = spinSpeedRef.current === '33' ? 33 : 45;
            const rpm = currentSpeed * (1 - easeOut);
            const rotationsPerSecond = rpm / 60;
            const deltaTime = (currentTime - lastTime) / 1000;
            lastTime = currentTime;
            setRotation(prev => prev + rotationsPerSecond * 2 * Math.PI * deltaTime);
            requestAnimationFrame(animate);
          } else {
            isSpinning.current = false;
            isStoppingManually.current = false;

            // Calculate which segment is under the needle (5 o'clock position)
            if (onStopComplete && data.length > 0) {
              const needleAngle = Math.PI / 6; // 5 o'clock
              const numSegments = data.length;
              const arcSize = (2 * Math.PI) / numSegments;
              // Get current rotation and normalize
              const normalizedRot = ((rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
              // Calculate which segment the needle points to
              const relativeAngle = ((needleAngle - normalizedRot) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
              const stoppedIndex = Math.floor(relativeAngle / arcSize) % numSegments;
              onStopComplete(stoppedIndex);
            }
          }
          return;
        }

        // Continuous rotation at selected RPM
        const currentSpeed = spinSpeedRef.current === '33' ? 33 : 45;
        const rotationsPerSecond = currentSpeed / 60;
        const deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;

        setRotation(prev => prev + rotationsPerSecond * 2 * Math.PI * deltaTime);
        requestAnimationFrame(animate);
      };

      requestAnimationFrame(animate);
    }
  }, [mustStartSpinning, prizeNumber, data.length, rotation, getTonearmAngles, onStopComplete, onRouletteComplete]);

  // Animate a small spin when filter transition is triggered
  useEffect(() => {
    if (filterTransition && !isSpinning.current) {
      const startRot = rotation;
      // Random rotation between 30 and 120 degrees
      const randomDegrees = 30 + Math.random() * 90;
      const targetRot = rotation + (randomDegrees * Math.PI / 180);
      const duration = 1500; // ms
      const startTime = performance.now();

      const animateFilterSpin = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        if (elapsed < duration) {
          const t = elapsed / duration;
          // Quick start, long gradual deceleration (cubic ease-out)
          const easeOut = 1 - Math.pow(1 - t, 3);
          setRotation(startRot + (targetRot - startRot) * easeOut);
          requestAnimationFrame(animateFilterSpin);
        } else {
          setRotation(targetRot);
        }
      };
      requestAnimationFrame(animateFilterSpin);
    }
  }, [filterTransition]);

  // Animate tonearm back to rest position when resetTonearm becomes true
  useEffect(() => {
    if (resetTonearm && !tonearmAnimating.current) {
      tonearmAnimating.current = true;
      tonearmStartTime.current = performance.now();

      // Capture angles once at the start of animation
      const angles = getTonearmAngles();
      const startAngle = angles.playingAngle;
      const endAngle = angles.restAngle;

      const animateBack = (currentTime: number) => {
        const elapsed = (currentTime - tonearmStartTime.current) / 1000;
        const duration = 0.5; // 500ms to lift arm

        if (elapsed < duration) {
          const t = elapsed / duration;
          const easeOut = 1 - Math.pow(1 - t, 2); // Quadratic ease-out
          const currentAngle = startAngle + (endAngle - startAngle) * easeOut;
          setTonearmAngle(currentAngle);
          requestAnimationFrame(animateBack);
        } else {
          setTonearmAngle(endAngle);
          tonearmAnimating.current = false;
        }
      };
      requestAnimationFrame(animateBack);
    }
  }, [resetTonearm, getTonearmAngles]);

  // Handle button clicks on canvas
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!buttonPositions.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ('touches' in event) {
      if (event.touches.length === 0) return;
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    // Convert to canvas coordinates
    const scaleX = canvas.width / dpr / rect.width;
    const scaleY = canvas.height / dpr / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    // Check each button
    const { speed, stop, start } = buttonPositions.current;

    // Check SPEED button
    const distSpeed = Math.sqrt(Math.pow(x - speed.x, 2) + Math.pow(y - speed.y, 2));
    if (distSpeed <= speed.radius && !mustStartSpinning && onSpeedToggle) {
      setPressedButton('speed');
      setTimeout(() => setPressedButton(null), 150);
      onSpeedToggle();
      return;
    }

    // Check STOP button
    const distStop = Math.sqrt(Math.pow(x - stop.x, 2) + Math.pow(y - stop.y, 2));
    if (distStop <= stop.radius && mustStartSpinning && !isStoppingManually.current && onStopClick) {
      setPressedButton('stop');
      setTimeout(() => setPressedButton(null), 150);
      onStopClick();
      return;
    }

    // Check START button
    const distStart = Math.sqrt(Math.pow(x - start.x, 2) + Math.pow(y - start.y, 2));
    if (distStart <= start.radius && !mustStartSpinning && onStartClick) {
      setPressedButton('start');
      setTimeout(() => setPressedButton(null), 150);
      onStartClick();
      return;
    }

    // Check if clicked on the wheel (vinyl) - not buttons
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;
    const scale = canvasSize / 600;
    const scaledBorderWidth = outerBorderWidth * scale;
    const radius = Math.min(centerX, centerY) - scaledBorderWidth - 10 * scale;
    const distFromCenter = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));

    if (distFromCenter <= radius && !mustStartSpinning && onWheelClick) {
      onWheelClick();
      return;
    }
  }, [buttonPositions, dpr, mustStartSpinning, onSpeedToggle, onStopClick, onStartClick, onWheelClick, canvasSize, outerBorderWidth]);

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
        onClick={handleCanvasClick}
        onTouchEnd={handleCanvasClick}
        style={{
          width: `${canvasSize * 1.30}px`,
          height: `${canvasSize * 1.15}px`,
          maxWidth: '100%',
          maxHeight: '100%',
          touchAction: 'manipulation', // Prevent zoom on double-tap
          cursor: 'pointer'
        }}
      />
    </div>
  );
};

export default RouletteWheel;

