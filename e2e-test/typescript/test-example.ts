describe('Math Operations Test Suite', () => {
  it('should add numbers correctly', () => {
    expect(5 + 3).toBe(8);
    expect(10 + 20).toBe(30);
    expect(-5 + 5).toBe(0);
  });

  it('should multiply numbers correctly', () => {
    const result = 6 * 7;
    expect(result).toBe(42);
    expect(0 * 100).toBe(0);
    expect(-3 * 4).toBe(-12);
  });

  it('should handle division', () => {
    expect(10 / 2).toBe(5);
    expect(100 / 4).toBe(25);
    expect(7 / 2).toBeCloseTo(3.5);
  });

  it('should calculate square roots', () => {
    expect(Math.sqrt(9)).toBe(3);
    expect(Math.sqrt(16)).toBe(4);
    expect(Math.sqrt(2)).toBeCloseTo(1.414, 3);
  });
});