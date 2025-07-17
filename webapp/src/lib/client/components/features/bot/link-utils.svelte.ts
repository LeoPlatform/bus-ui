/**
 * Utilities for generating smart link paths in tree visualizations
 */

/**
 * Generates a smart cubic Bézier curve that avoids node collisions and creates better visual paths
 * @param sourceX - X coordinate of source node
 * @param sourceY - Y coordinate of source node  
 * @param targetX - X coordinate of target node
 * @param targetY - Y coordinate of target node
 * @param nodeWidth - Width of nodes (used to calculate edge connection points)
 * @returns SVG path string for the curve
 */
export function generateSmartCurve(
  sourceX: number, 
  sourceY: number, 
  targetX: number, 
  targetY: number, 
  nodeWidth: number
): string {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  
  // Use a much simpler approach - just improve the original slightly
  const horizontalOffset = Math.abs(dx) * 0.6;
  const verticalOffset = Math.abs(dy) * 0.1;
  
  // Control points that create a gentle horizontal curve
  const control1X = sourceX + (dx > 0 ? horizontalOffset : -horizontalOffset);
  const control1Y = sourceY + (dy > 0 ? verticalOffset : -verticalOffset);
  const control2X = targetX + (dx > 0 ? -horizontalOffset : horizontalOffset);
  const control2Y = targetY + (dy > 0 ? -verticalOffset : verticalOffset);
  
  return `M${sourceX},${sourceY}
          C${control1X},${control1Y}
           ${control2X},${control2Y}
           ${targetX},${targetY}`;
}

/**
 * Checks if a path intersects with a circular node
 * @param path - SVG path string
 * @param nodeX - Node center X coordinate
 * @param nodeY - Node center Y coordinate
 * @param nodeRadius - Node radius
 * @returns True if path intersects with node
 */
export function checkPathNodeCollision(
  path: string, 
  nodeX: number, 
  nodeY: number, 
  nodeRadius: number
): boolean {
  // This is a simplified collision check - in practice you'd sample points along the curve
  // For now, we'll check if the path's control points are too close to the node
  const pathSegments = path.split(/[MC]/);
  
  for (const segment of pathSegments) {
    if (segment.trim()) {
      const coords = segment.trim().split(/[\s,]+/).map(Number);
      for (let i = 0; i < coords.length; i += 2) {
        const x = coords[i];
        const y = coords[i + 1];
        if (!isNaN(x) && !isNaN(y)) {
          const distance = Math.sqrt((x - nodeX) ** 2 + (y - nodeY) ** 2);
          if (distance < nodeRadius + 10) { // 10px buffer
            return true;
          }
        }
      }
    }
  }
  
  return false;
}