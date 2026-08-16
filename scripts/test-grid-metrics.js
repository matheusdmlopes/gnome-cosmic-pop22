// Test suite for the applications grid arithmetic under pure gjs.
//
// The regression these cases lock down: St.Viewport derives a StScrollView's
// scrollable extent from the layout manager's *minimum* height, clamped up to
// the visible height. Clutter.FlowLayout reports a single row as its minimum,
// so the adjustment's upper collapsed onto its page size and the grid would not
// scroll even though it painted seven rows. The grid metrics below must report
// the full wrapped height, and CosmicAppGridLayout reports it as both the
// minimum and the natural height.

import System from 'system';

const { gridMetrics } = await import('../cosmic/gridMetrics.js');

let passed = 0;
let failed = 0;

function run_test(name, fn) {
    try {
        fn();
        print(`  PASS: ${name}`);
        passed += 1;
    } catch (e) {
        printerr(`  FAIL: ${name}: ${e.message}`);
        failed += 1;
    }
}

function assert_equal(actual, expected, label) {
    if (actual !== expected)
        throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

print('Running applications grid metrics test suite (gjs)...');

// Case 1: The measured production geometry. A 1176px viewport fits six 192px
// icons per row; 41 icons therefore need seven rows, or 1344px, against the
// 564px the dialog gives the scroll view.
run_test('1. Measured home-view geometry wraps to seven rows', () => {
    const m = gridMetrics({ availableWidth: 1176, itemWidth: 192, itemHeight: 192, count: 41 });
    assert_equal(m.columns, 6, 'columns');
    assert_equal(m.rows, 7, 'rows');
    assert_equal(m.contentHeight, 1344, 'contentHeight');
    assert_equal(m.cellWidth, 196, 'cellWidth');
    assert_equal(m.cellHeight, 192, 'cellHeight');
});

// Case 2: The reported folder case. Twenty-one applications overflow three rows,
// which is exactly the height the dialog allots, so the fourth row is only
// reachable by scrolling.
run_test('2. A 21-app folder overflows the three visible rows', () => {
    const m = gridMetrics({ availableWidth: 1176, itemWidth: 192, itemHeight: 192, count: 21 });
    assert_equal(m.columns, 6, 'columns');
    assert_equal(m.rows, 4, 'rows');
    assert_equal(m.contentHeight, 768, 'contentHeight');
    if (m.contentHeight <= 564)
        throw new Error('content must exceed the 564px viewport for the grid to scroll');
});

// Case 3: Content that fits must not report a scrollable overflow, otherwise the
// scrollbar would appear on every folder.
run_test('3. Content that fits reports exactly one row', () => {
    const m = gridMetrics({ availableWidth: 1176, itemWidth: 192, itemHeight: 192, count: 4 });
    assert_equal(m.rows, 1, 'rows');
    assert_equal(m.contentHeight, 192, 'contentHeight');
});

// Case 4: Cells are sized by the grid, not by the item count. Four icons in a
// six-column grid stay 196px wide and left-aligned rather than stretching across
// the viewport, which is what Clutter.FlowLayout did when homogeneous.
run_test('4. A short row keeps the full grid column count', () => {
    const m = gridMetrics({ availableWidth: 1176, itemWidth: 192, itemHeight: 192, count: 4 });
    assert_equal(m.columns, 6, 'columns');
    assert_equal(m.cellWidth, 196, 'cellWidth');
});

// Case 5: An unconstrained width query is how Clutter asks for the natural
// width. It must describe a single row so the viewport's natural width stays
// count * itemWidth, matching what FlowLayout reported.
run_test('5. Unconstrained width lays out a single row', () => {
    const m = gridMetrics({ availableWidth: -1, itemWidth: 192, itemHeight: 192, count: 41 });
    assert_equal(m.columns, 41, 'columns');
    assert_equal(m.rows, 1, 'rows');
    assert_equal(m.cellWidth, 192, 'cellWidth');
    assert_equal(m.contentHeight, 192, 'contentHeight');
});

// Case 6: A viewport narrower than a single icon still allocates one column
// instead of dividing by zero or collapsing to none.
run_test('6. A viewport narrower than one icon keeps one column', () => {
    const m = gridMetrics({ availableWidth: 100, itemWidth: 192, itemHeight: 192, count: 5 });
    assert_equal(m.columns, 1, 'columns');
    assert_equal(m.rows, 5, 'rows');
    assert_equal(m.cellWidth, 192, 'cellWidth');
});

// Case 7: An empty grid has no content, so the adjustment stays collapsed and
// no scrollbar appears.
run_test('7. An empty grid reports no content', () => {
    const m = gridMetrics({ availableWidth: 1176, itemWidth: 0, itemHeight: 0, count: 0 });
    assert_equal(m.columns, 0, 'columns');
    assert_equal(m.rows, 0, 'rows');
    assert_equal(m.contentHeight, 0, 'contentHeight');
});

// Case 8: Icons are placed left to right and wrap onto the next row. The
// measured baseline put icon 0 at x=0, icon 1 at x=196 and icon 40 at (784, 1152).
run_test('8. Icon positions match the measured FlowLayout baseline', () => {
    const m = gridMetrics({ availableWidth: 1176, itemWidth: 192, itemHeight: 192, count: 41 });
    const positionOf = index => [
        (index % m.columns) * m.cellWidth,
        Math.floor(index / m.columns) * m.cellHeight,
    ];
    assert_equal(positionOf(0).join(','), '0,0', 'icon 0');
    assert_equal(positionOf(1).join(','), '196,0', 'icon 1');
    assert_equal(positionOf(6).join(','), '0,192', 'icon 6');
    assert_equal(positionOf(40).join(','), '784,1152', 'icon 40');
});

print(`Grid metrics results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
    System.exit(1);
}
