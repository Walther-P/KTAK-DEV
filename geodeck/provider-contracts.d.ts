// Native integration contract; unavailable data stays null/empty, never inferred from UI text.
export interface Point { lat: number; lng: number }
export interface Freshness { provider: string; source: string; lastUpdated: string | null; fetchedAt: string | null }
export interface Lane { direction: string[]; recommended: boolean | null; active: boolean | null }
export interface NavigationInstruction {
  maneuver: string | null; instruction: string; distanceToManeuver: number | null;
  roadName: string | null; exitNumber: string | null; junction: string | null; fork: string | null;
  lanes: Lane[]; laneGuidance: 'available' | 'unavailable';
}
export interface RoadSpeedLimit extends Freshness { value: number | null; unit: 'km/h'; roadId: string | null }
export interface EnforcementPoint extends Point, Freshness {
  id: string; kind: 'fixed-speed' | 'red-light' | 'technology' | 'section-start' | 'section-end';
  directionText: string; speedLimit: number | null;
}
export interface CameraCoverage extends Point, Freshness {
  heading: number | null; fov: number | null; range: number | null;
  confidence: 'confirmed' | 'likely' | 'nearby-only';
}
export interface LocationService { watch(onFix: (position: GeolocationPosition) => void, onError: () => void): () => void }
export interface EnforcementProvider { load(): Promise<{ points: EnforcementPoint[] } & Freshness> }
export interface SpeedLimitProvider { at(position: Point, heading: number): Promise<RoadSpeedLimit | null> }
export interface NavigationProvider { laneGuidance: boolean; backgroundLocation: boolean; stop(): void }
