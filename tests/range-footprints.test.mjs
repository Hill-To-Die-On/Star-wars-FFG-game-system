import test from "node:test";
import assert from "node:assert/strict";
import * as geometry from "../src/range-overlay/footprints.mjs";
import { calibrationFromPointer, chooseRangeLabelLayout, chooseAttackTraceLabelLayout } from "../src/range-overlay/core.mjs";

const circle = (x, y, size = 100) => geometry.rangeFootprint({ x, y, width: size, height: size });
const hull = (x, y, width, height = width) => geometry.rangeFootprint({ x, y, width, height, shape: "rectangle" });
const close = (a, b) => assert.ok(Math.abs(a - b) < 0.00001, `${a} != ${b}`);
const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

test("personal range measures the gap between circular footprints", () => {
  const a = circle(0, 0), b = circle(300, 400);
  const result = geometry.measureFootprintGap(a, b);
  close(result.distance, 400);
  assert.deepEqual(result.source, { x: 30, y: 40 });
  assert.deepEqual(result.target, { x: 270, y: 360 });
  close(geometry.measureFootprintGap(b, a).distance, result.distance);
});

test("large square hulls measure from sides and corners instead of their centres", () => {
  close(geometry.measureFootprintGap(circle(0, 0), hull(550, 0, 800)).distance, 100);
  close(geometry.measureFootprintGap(hull(0, 0, 200), hull(500, 600, 400)).distance, Math.hypot(200, 300));
  close(geometry.measureFootprintGap(circle(0, 0), hull(200, 200, 100)).distance, Math.hypot(150, 150) - 50);
});

test("touching, overlapping, contained and dimensionless footprints never give negative ranges", () => {
  for (const [a, b] of [[circle(0, 0), circle(100, 0)], [circle(0, 0), circle(30, 0)], [circle(0, 0), hull(0, 0, 500)]]) {
    const result = geometry.measureFootprintGap(a, b);
    assert.equal(result.distance, 0);
    assert.deepEqual(result.source, result.target);
  }
  close(geometry.measureFootprintGap(circle(0, 0, 0), circle(300, 400, 0)).distance, 500);
});

test("every point of the expanded overlay is the stated distance from the origin footprint", () => {
  for (const footprint of [circle(200, 200), hull(200, 200, 400, 200)]) {
    for (const distance of [20, 100, 800]) {
      const outline = geometry.rangeOutline(footprint, distance);
      close(outline.width, footprint.width + distance * 2);
      for (let degree = 0; degree < 360; degree += 5) {
        const point = geometry.footprintBoundaryPoint(footprint, distance, degree * Math.PI / 180);
        close(geometry.measureFootprintGap(footprint, geometry.rangeFootprint(point)).distance, distance);
      }
    }
  }
});

test("ToM calibration stores distance from the token edge and rejects clicks inside its footprint", () => {
  const footprint = hull(200, 200, 200);
  assert.deepEqual(calibrationFromPointer(footprint, { x: 420, y: 200 }, { footprint }), { anchorRadiusPx: 120 });
  assert.throws(() => calibrationFromPointer(footprint, { x: 280, y: 200 }, { footprint }), /farther/i);
});

test("range labels follow the same expanded hull outline as measurement", () => {
  const footprint = hull(400, 300, 300, 100);
  const layout = chooseRangeLabelLayout({ origin: footprint, footprint, radius: 100, size: { width: 60, height: 20 }, viewport: { left: 0, top: 0, right: 900, bottom: 700 }, preferredAngle: 0 });
  assert.equal(layout.onArc, true);
  close(layout.x, 650);
  close(geometry.measureFootprintGap(footprint, geometry.rangeFootprint(layout)).distance, 100);
});

test("combat cards find a free area beyond a crowded attack line", () => {
  const occupied = [
    { left: 0, top: 250, right: 1000, bottom: 700 },
    { left: 0, top: 0, right: 330, bottom: 250 },
    { left: 700, top: 0, right: 1000, bottom: 250 },
  ];
  const layout = chooseAttackTraceLabelLayout({ source: { x: 350, y: 580 }, target: { x: 800, y: 600 }, size: { width: 300, height: 150 }, viewport: { left: 0, top: 0, right: 1000, bottom: 700 }, occupied });
  assert.ok(layout);
  assert.ok(occupied.every(obstacle => !overlaps(layout.bounds, obstacle)));
  assert.ok(layout.bounds.top >= 12 && layout.bounds.bottom <= 688);
});

test("combat cards retain a clear position, move when obstructed and handle overlapping tokens", () => {
  const options = { source: { x: 300, y: 300 }, target: { x: 300, y: 300 }, size: { width: 250, height: 120 }, viewport: { left: 0, top: 0, right: 1000, bottom: 700 }, current: { x: 600, y: 100 } };
  const initial = chooseAttackTraceLabelLayout(options);
  assert.deepEqual({ x: initial.x, y: initial.y }, options.current);
  const moved = chooseAttackTraceLabelLayout({ ...options, occupied: [initial.bounds] });
  assert.ok(!overlaps(moved.bounds, initial.bounds));
});


test("rotated hulls choose a corner off the centre ray and return the actual shortest segment", () => {
  const target = geometry.rangeFootprint({ x: 1000, y: 0, width: 400, height: 1000, shape: "rectangle", rotation: 45 });
  const corner = { x: 1000 - 700 / Math.sqrt(2), y: 300 / Math.sqrt(2) };
  const expected = Math.hypot(corner.x, corner.y) - 50;
  const result = geometry.measureFootprintGap(circle(0, 0), target);
  close(result.distance, expected);
  close(result.target.x, corner.x); close(result.target.y, corner.y);
  close(Math.hypot(result.target.x-result.source.x, result.target.y-result.source.y), expected);
  close(geometry.measureFootprintGap(target, circle(0, 0)).distance, expected);
  assert.ok(result.distance < 600);
});

test("rotated hull-to-hull distances include edge projections, overlap and containment", () => {
  const rotated = (x, y, width, height, rotation) => geometry.rangeFootprint({x,y,width,height,rotation,shape:"rectangle"});
  const a = rotated(0,0,200,1000,90), b = rotated(800,0,200,1000,0);
  close(geometry.measureFootprintGap(a,b).distance,200);
  assert.equal(geometry.measureFootprintGap(a,rotated(0,0,200,1000,0)).distance,0);
  assert.equal(geometry.measureFootprintGap(rotated(0,0,1000,1000,45),circle(0,0)).distance,0);
  // Rotate and translate a known 300px side-to-side gap: rigid motion must preserve it.
  for (const degrees of [15,45,89,135,271]) {
    const angle=degrees*Math.PI/180, offset={x:Math.cos(angle)*500,y:Math.sin(angle)*500};
    const left=rotated(350,-180,200,300,degrees), right=rotated(350+offset.x,-180+offset.y,200,300,degrees);
    close(geometry.measureFootprintGap(left,right).distance,300);
  }
});

test("rotated outlines and label anchors remain exactly the specified gap from the hull", () => {
  for (const rotation of [15,45,90,137]) {
    const footprint=geometry.rangeFootprint({x:400,y:300,width:500,height:100,shape:"rectangle",rotation});
    const outline=geometry.rangeOutline(footprint,100);
    assert.equal(outline.rotation,rotation);
    for (let degree=0;degree<360;degree+=15) {
      const point=geometry.footprintBoundaryPoint(footprint,100,degree*Math.PI/180);
      close(geometry.measureFootprintGap(footprint,geometry.rangeFootprint(point)).distance,100);
    }
  }
});
