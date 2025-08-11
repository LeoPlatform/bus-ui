import type { DashboardStatsValue } from "$lib/types";
import type { ChartDataset } from "chart.js/auto";
import regression, { type DataPoint } from "regression";

export type RegressionType = 'linear' | 'exponential' | 'polynomial' | 'power' | 'logarithmic';
export const regressionTypes: RegressionType[] = ['linear', 'exponential', 'polynomial', 'power', 'logarithmic']

export interface RegressionOptions {
    type?: RegressionType;
    data: DashboardStatsValue[];
    /**
     * The number of data points to shave off.
     * 
     * A negative value will shave off from the end of the data.
     */
    offset?: number;
    bestFit?: boolean;
    label?: string;

}


function convertToRegressionValidData(data: DashboardStatsValue[]): {data: [number, number][], xVals: [number, number][]} {
    return {data: data.map((item) => [item.time, item.value]), xVals: data.filter((item) => item.value == 0).map((item) => [item.time, item.value])};
}

export function createDataSet(opts: RegressionOptions): ChartDataset<"line"> {
    if(!opts.type && !opts.bestFit) {
        throw new Error('Either type or bestFit must be provided');
    }

    if (opts.type && opts.bestFit) {
        throw new Error('Either type or bestFit must be provided, not both');
    }
    
    if (opts.offset) {
        opts.data = opts.data.slice(opts.offset);
    }

    const {data, xVals} = convertToRegressionValidData(opts.data);


    let reg: regression.Result;

    if (opts.bestFit) {
        reg = findBestRegression(data);
    }

    if (opts.type) {
        switch (opts.type) {
            case 'linear':
                reg = regression.linear(data);
                break;
            case 'exponential':
                reg = regression.exponential(data);
                break;
            case 'polynomial':
                reg = regression.polynomial(data);
                break;
            case 'power':
                reg = regression.power(data);
                break;
            case 'logarithmic':
                    reg = regression.logarithmic(data);
                    break;
            }
    }
    // Extend the regression line and predict what 0 values would be
    const extendedData = xVals.map(([x, _]) => {
        const point = reg!.predict(x);
        return {x: point[0], y: point[1]};
    });


    const regressionLine = reg!.points.map((item) => ({
        x: item[0], // Maps to time
        y: item[1],
    })).concat(extendedData).sort((a, b) => a.x - b.x);
    return {
        // labels: regressionLine.map((item) => item.x),
        data: regressionLine,
        borderColor: 'green',
        borderWidth: 2,
        borderDash: [5, 5],
        pointStyle: false,
        label: opts.label,
        xAxisID: 'x',
    };
}

/**
 * Evaluates all available regression types and returns the best fit
 * @param data - The data points to analyze
 * @returns The best regression type and all results
 */
export function findBestRegression(data: [number, number][]): regression.Result {
    
    const results: regression.Result[] = [];
    
    // Test each regression type
    for (const type of regressionTypes) {
        try {
            let result: regression.Result;
            
            switch (type) {
                case 'linear':
                    result = regression.linear(data);
                    break;
                case 'exponential':
                    result = regression.exponential(data);
                    break;
                case 'polynomial':
                    result = regression.polynomial(data);
                    break;
                case 'power':
                    result = regression.power(data);
                    break;
                case 'logarithmic':
                    result = regression.logarithmic(data);
                    break;
                default:
                    continue;
            }
            
            results.push(result);
        } catch (error) {
            console.warn(`Failed to calculate ${type} regression:`, error);
            // Continue with other types even if one fails
        }
    }
    
    // Find the best result based on R-squared value
    const bestResult = results.reduce((best, current) => {
        return current.r2 > best.r2 ? current : best;
    }, results[0]);
    
    return bestResult;
}
