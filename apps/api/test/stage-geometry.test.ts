import { describe, expect, it } from 'vitest';
import { seatLightMatrices } from '../../web/src/lib/stageGeometry';

describe('stage rendering layout', () => {
  it('matches 4220 empty seat positions and assigns ordered arena phases', () => {
    const seats = seatLightMatrices();
    expect(seats).toHaveLength(4220);
    expect(seats.every((seat) => seat.phase > 0 && seat.phase < 1)).toBe(true);
    expect(seats.every((seat) => seat.matrix.elements.every(Number.isFinite))).toBe(true);
  });
});
