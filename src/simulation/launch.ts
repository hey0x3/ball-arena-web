export type LaunchAngles = [number, number];
export const DEFAULT_LAUNCH_ANGLES: LaunchAngles = [45, 225];
export const normalizeAngle = (angle: number) => (angle % 360 + 360) % 360;
export function isLaunchAngles(value: unknown): value is LaunchAngles {
  return Array.isArray(value) && value.length === 2 && value.every(angle => typeof angle === 'number' && Number.isFinite(angle) && angle >= 0 && angle < 360);
}
