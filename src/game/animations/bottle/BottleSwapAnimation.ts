import type Phaser from 'phaser';
import { MotionEasings, MotionParams } from '../../../design-system/tokens/Motion';
import { getBottleMetadata } from '../../assets/BottleCatalog';
import type { BottleSprite } from '../../components/bottles/BottleSprite';
import { BottleMotionTrail } from '../../components/effects/BottleMotionTrail';
import type { AnimationPolicy } from '../core/AnimationPolicy';
import {
  computeSwapTrajectories,
  sampleSwapCurve,
  type SafeTrajectoryBounds,
} from '../utils/AnimationCurves';
import { computeFlightTilt, lerp, type Point2D } from '../utils/AnimationMath';

export interface BottleSwapAnimationParams {
  readonly scene: Phaser.Scene;
  readonly spriteA: BottleSprite;
  readonly spriteB: BottleSprite;
  readonly fromA: Point2D;
  readonly fromB: Point2D;
  readonly bottlesLayer: Phaser.GameObjects.Container;
  readonly policy: AnimationPolicy;
  readonly bounds?: SafeTrajectoryBounds;
  readonly onComplete: () => void;
}

/**
 * Multi-stage bottle swap animation (~470ms normal motion; short direct glide in reduced motion):
 *   1. Anticipation (70ms): slight vertical lift + subtle travel-direction tilt.
 *   2. Movement (300ms): opposing quadratic Bezier flight with grounded dynamic shadow tracking,
 *      mid-flight tilt, depth staging, and optional subtle motion trail on longer swaps.
 *   3. Landing (100ms): exact slot snap + restrained relative squash-and-stretch settling + shadow compression.
 *
 * Returns a cancellation function that stops all tweens/trails and resets both sprites cleanly.
 */
export function playBottleSwapAnimation(params: BottleSwapAnimationParams): () => void {
  const { scene, spriteA, spriteB, fromA, fromB, bottlesLayer, policy, bounds, onComplete } =
    params;

  const dimsA = spriteA.getBottleDimensions();
  const dimsB = spriteB.getBottleDimensions();
  const bottleWidth = Math.max(dimsA.width, dimsB.width);
  const bottleHeight = Math.max(dimsA.height, dimsB.height);

  let activeTweens: Phaser.Tweens.Tween[] = [];
  let trails: BottleMotionTrail[] = [];
  let finished = false;

  const stopAll = (): void => {
    for (const tween of activeTweens) {
      tween.stop();
    }
    activeTweens = [];
    for (const trail of trails) {
      trail.cancel();
    }
    trails = [];
  };

  const resetSpritesToResting = (): void => {
    spriteA.resetVisualTransform();
    spriteB.resetVisualTransform();
  };

  const finishOnce = (): void => {
    if (finished) {
      return;
    }
    finished = true;
    stopAll();
    spriteA.setPosition(fromB.x, fromB.y);
    spriteB.setPosition(fromA.x, fromA.y);
    resetSpritesToResting();
    onComplete();
  };

  const cancel = (): void => {
    if (finished) {
      return;
    }
    finished = true;
    stopAll();
    resetSpritesToResting();
  };

  // Prepare both sprites for swap (clears selection/hover/press without firing visual state tweens)
  spriteA.setPosition(fromA.x, fromA.y);
  spriteB.setPosition(fromB.x, fromB.y);
  spriteA.setSwapping(true, true, false);
  spriteB.setSwapping(true, true, false);
  bottlesLayer.bringToTop(spriteB);
  bottlesLayer.bringToTop(spriteA);

  // Reduced-motion path: short direct glide with zero lift, tilt, squash, or trails
  if (policy.reducedMotion || !policy.allowCurvedSwap) {
    if (policy.swapMovementMs <= 0) {
      finishOnce();
      return cancel;
    }

    const proxy = { t: 0 };
    activeTweens.push(
      scene.tweens.add({
        targets: proxy,
        t: 1,
        duration: policy.swapMovementMs,
        ease: MotionEasings.EaseInOut,
        onUpdate: () => {
          if (finished) {
            return;
          }
          spriteA.setPosition(lerp(fromA.x, fromB.x, proxy.t), lerp(fromA.y, fromB.y, proxy.t));
          spriteB.setPosition(lerp(fromB.x, fromA.x, proxy.t), lerp(fromB.y, fromA.y, proxy.t));
        },
        onComplete: finishOnce,
      }),
    );
    return cancel;
  }

  const trajectories = computeSwapTrajectories({
    fromA,
    fromB,
    bottleWidth,
    bottleHeight,
    ...(bounds !== undefined ? { bounds } : {}),
  });

  const anticipationLift = Math.round(bottleHeight * MotionParams.swapAnticipationLiftRatio);
  const dxA = fromB.x - fromA.x;
  const dirA = dxA >= 0 ? 1 : -1;
  const anticipationTiltA = policy.allowTilt ? dirA * MotionParams.swapAnticipationTiltRad : 0;
  const anticipationTiltB = policy.allowTilt ? -dirA * MotionParams.swapAnticipationTiltRad : 0;

  // Optional lightweight trail only for longer swaps
  if (policy.allowMotionTrails && trajectories.isLongSwap) {
    const metaA = getBottleMetadata(spriteA.getBottleId());
    const metaB = getBottleMetadata(spriteB.getBottleId());
    trails.push(
      new BottleMotionTrail(scene, {
        colorHex: metaA.colorHex,
        bottleWidth,
        policy,
        depth: bottlesLayer.depth,
      }),
      new BottleMotionTrail(scene, {
        colorHex: metaB.colorHex,
        bottleWidth,
        policy,
        depth: bottlesLayer.depth,
      }),
    );
  }

  const runLandingStage = (): void => {
    if (finished) {
      return;
    }

    // Snap exactly to destination slot coordinates first
    spriteA.setPosition(fromB.x, fromB.y);
    spriteB.setPosition(fromA.x, fromA.y);
    spriteA.setSwapTransform({
      liftY: 0,
      rotation: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowElevation: 0,
    });
    spriteB.setSwapTransform({
      liftY: 0,
      rotation: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowElevation: 0,
    });

    if (!policy.allowSquashStretch || policy.bottleLandingMs <= 0) {
      finishOnce();
      return;
    }

    spriteA.getShadow().playLandingCompression(policy.bottleLandingMs);
    spriteB.getShadow().playLandingCompression(policy.bottleLandingMs);

    const squashMs = Math.max(24, Math.round(policy.bottleLandingMs * 0.42));
    const settleMs = Math.max(30, policy.bottleLandingMs - squashMs);

    const landingProxy = { progress: 0 };
    activeTweens.push(
      scene.tweens.add({
        targets: landingProxy,
        progress: 1,
        duration: squashMs,
        ease: MotionEasings.EaseOutQuad,
        onUpdate: () => {
          if (finished) {
            return;
          }
          const sx = lerp(1, MotionParams.landingSquashX, landingProxy.progress);
          const sy = lerp(1, MotionParams.landingSquashY, landingProxy.progress);
          spriteA.setSwapTransform({ scaleX: sx, scaleY: sy });
          spriteB.setSwapTransform({ scaleX: sx, scaleY: sy });
        },
        onComplete: () => {
          if (finished) {
            return;
          }
          const settleProxy = { progress: 0 };
          activeTweens.push(
            scene.tweens.add({
              targets: settleProxy,
              progress: 1,
              duration: settleMs,
              ease: MotionEasings.GentleSettle,
              onUpdate: () => {
                if (finished) {
                  return;
                }
                const sx = lerp(MotionParams.landingSquashX, 1, settleProxy.progress);
                const sy = lerp(MotionParams.landingSquashY, 1, settleProxy.progress);
                spriteA.setSwapTransform({ scaleX: sx, scaleY: sy });
                spriteB.setSwapTransform({ scaleX: sx, scaleY: sy });
              },
              onComplete: finishOnce,
            }),
          );
        },
      }),
    );
  };

  const runFlightStage = (): void => {
    if (finished) {
      return;
    }

    const flightProxy = { t: 0 };
    let nextTrailThreshold = 0.2;
    const trailStep = 0.16;

    activeTweens.push(
      scene.tweens.add({
        targets: flightProxy,
        t: 1,
        duration: Math.max(60, policy.swapMovementMs),
        ease: MotionEasings.EaseInOut,
        onUpdate: () => {
          if (finished) {
            return;
          }
          const t = flightProxy.t;
          const posA = sampleSwapCurve(trajectories.curveA, t);
          const posB = sampleSwapCurve(trajectories.curveB, t);

          spriteA.setPosition(posA.x, posA.y);
          spriteB.setPosition(posB.x, posB.y);

          // Linear chord ground positions keep shadows visually anchored along the rack surface
          const groundAX = lerp(fromA.x, fromB.x, t);
          const groundAY = lerp(fromA.y, fromB.y, t);
          const groundBX = lerp(fromB.x, fromA.x, t);
          const groundBY = lerp(fromB.y, fromA.y, t);

          const arcElevationA =
            Math.max(0, groundAY - posA.y) + anticipationLift * (1 - Math.abs(t * 2 - 1));
          const arcElevationB =
            Math.max(0, groundBY - posB.y) + anticipationLift * 0.65 * (1 - Math.abs(t * 2 - 1));

          const liftFade = Math.sin(Math.PI * t);
          const bodyLiftA = -Math.round(anticipationLift * (0.4 + 0.6 * liftFade));
          const bodyLiftB = -Math.round(anticipationLift * (0.3 + 0.5 * liftFade));

          const rotA = policy.allowTilt
            ? computeFlightTilt(fromB.x - fromA.x, t, MotionParams.maxBottleTiltRad)
            : 0;
          const rotB = policy.allowTilt
            ? computeFlightTilt(fromA.x - fromB.x, t, MotionParams.maxBottleTiltRad)
            : 0;

          const stretchX = policy.allowSquashStretch
            ? lerp(1, MotionParams.landingStretchX, liftFade)
            : 1;
          const stretchY = policy.allowSquashStretch
            ? lerp(1, MotionParams.landingStretchY, liftFade)
            : 1;

          spriteA.setSwapTransform({
            liftY: bodyLiftA,
            scaleX: stretchX,
            scaleY: stretchY,
            rotation: rotA,
            shadowOffsetX: groundAX - posA.x,
            shadowOffsetY: groundAY - posA.y,
            shadowElevation: arcElevationA + Math.abs(bodyLiftA),
          });
          spriteB.setSwapTransform({
            liftY: bodyLiftB,
            scaleX: stretchX,
            scaleY: stretchY,
            rotation: rotB,
            shadowOffsetX: groundBX - posB.x,
            shadowOffsetY: groundBY - posB.y,
            shadowElevation: arcElevationB + Math.abs(bodyLiftB),
          });

          // Emit sparse motion trail dots for long swaps
          if (trails.length === 2 && t >= nextTrailThreshold && t <= 0.85) {
            nextTrailThreshold += trailStep;
            trails[0]?.emitDot(posA.x, posA.y - bottleHeight * 0.45);
            trails[1]?.emitDot(posB.x, posB.y - bottleHeight * 0.45);
          }
        },
        onComplete: runLandingStage,
      }),
    );
  };

  // Stage 1: Anticipation (70ms)
  if (policy.swapAnticipationMs <= 0) {
    runFlightStage();
    return cancel;
  }

  const anticipationProxy = { p: 0 };
  activeTweens.push(
    scene.tweens.add({
      targets: anticipationProxy,
      p: 1,
      duration: policy.swapAnticipationMs,
      ease: MotionEasings.EaseOutQuad,
      onUpdate: () => {
        if (finished) {
          return;
        }
        const p = anticipationProxy.p;
        const lift = Math.round(anticipationLift * p);
        spriteA.setSwapTransform({
          liftY: -lift,
          rotation: anticipationTiltA * p,
          shadowElevation: lift,
        });
        spriteB.setSwapTransform({
          liftY: -lift,
          rotation: anticipationTiltB * p,
          shadowElevation: lift,
        });
      },
      onComplete: runFlightStage,
    }),
  );

  return cancel;
}
