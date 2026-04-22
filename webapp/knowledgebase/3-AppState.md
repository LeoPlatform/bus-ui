The main backend services that will be used for saving and retrieving data will be described in this document with their associated typescript types for the call and response.


# Stats API V2
The code for this API call can be located in `old_ui/api/stats/index.js` this api takes some query parameters that are defined in the `StatsQueryParams` interface within `webapp/src/lib/types.ts`.

The response of this API is a very large JSON object that contains the stats information for every system, queue, and bot in the bus. The type for the response is defined in the `StatsResponse` type within `webapp/src/lib/types.ts`.

