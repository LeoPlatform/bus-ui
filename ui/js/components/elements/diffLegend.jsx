import React from "react";

export const DiffLegend = () => {
    return (
        <div className="diff-legend">
            <div className="diff-legend-accepted">
                <div className="diff-legend-accepted-box"></div>
                <div className="diff-legend-accepted-text">new value</div>
            </div>
            <div className="diff-legend-removed">
                <div className="diff-legend-removed-box"></div>
                <div className="diff-legend-removed-text">old value</div>
            </div>
        </div>
    )
}

export default DiffLegend;