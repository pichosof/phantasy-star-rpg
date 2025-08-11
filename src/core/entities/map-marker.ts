import type { MapMarkerType } from '../../infra/db/schema';

export interface MapMarkerProps {
  id?: number;
  name: string;
  type?: MapMarkerType | null; // <-- aceita null
  coordinates?: string | null;
  description?: string | null;
  discovered?: boolean;
  createdAt?: Date;
}

export class MapMarker {
  private constructor(readonly props: MapMarkerProps) {}

  static create(p: Omit<MapMarkerProps, 'id' | 'createdAt'>) {
    if (!p.name?.trim()) throw new Error('Name required');
    return new MapMarker({ discovered: false, ...p });
  }

  static rehydrate(p: MapMarkerProps) {
    return new MapMarker(p); // agora compatível com null
  }
}
