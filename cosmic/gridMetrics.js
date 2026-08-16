// Grid arithmetic for the applications drawer, deliberately free of GI imports
// so it can be exercised under plain gjs (see scripts/test-grid-metrics.js).
//
// The numbers here decide whether the drawer scrolls at all. St.Viewport asks
// its layout manager for a minimum height and hands StScrollView
// MAX(visible height, minimum height) as the vertical adjustment's upper bound,
// so a layout that reports "one row" as its minimum can never produce a
// scrollable extent, however many rows it actually paints.

/**
 * Describes the grid a set of equally sized items forms in a given width.
 *
 * `availableWidth` below zero means unconstrained, which is how Clutter asks
 * for a natural width; the items then form a single row.
 *
 * @param {object} params
 * @param {number} params.availableWidth width to lay the items out in
 * @param {number} params.itemWidth width of a single item
 * @param {number} params.itemHeight height of a single item
 * @param {number} params.count number of items to place
 * @returns {{columns: number, rows: number, cellWidth: number, cellHeight: number, contentHeight: number}}
 */
export function gridMetrics({ availableWidth, itemWidth, itemHeight, count }) {
    if (count <= 0 || itemWidth <= 0 || itemHeight <= 0) {
        return {
            columns: 0,
            rows: 0,
            cellWidth: 0,
            cellHeight: 0,
            contentHeight: 0,
        };
    }

    if (availableWidth < 0) {
        return {
            columns: count,
            rows: 1,
            cellWidth: itemWidth,
            cellHeight: itemHeight,
            contentHeight: itemHeight,
        };
    }

    // Column count comes from the grid, not from the item count: a row holding
    // fewer items than fit keeps the same cell width and stays left-aligned,
    // which is what Clutter.FlowLayout did when homogeneous.
    const columns = Math.max(1, Math.floor(availableWidth / itemWidth));
    const rows = Math.ceil(count / columns);

    // Spare width is shared between the columns, the way a homogeneous flow
    // layout stretches its cells. A viewport narrower than a single item has no
    // spare width to share, so the cell keeps the item's own width and overflows.
    const cellWidth = Math.max(itemWidth, availableWidth / columns);

    return {
        columns,
        rows,
        cellWidth,
        cellHeight: itemHeight,
        contentHeight: rows * itemHeight,
    };
}
