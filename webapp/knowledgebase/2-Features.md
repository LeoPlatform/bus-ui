This website is a rewrite of an existing website that can be found in the `old_ui/` directory.

The features that this document describes are existing features from within the `old_ui/` directory as well as any new features that we will create as we go.

These features are

- Catalog view - this view is main landing page for botmon and gives us a snapshot overview of the number bots, which bots have been changed, and which bots are in an unhealthy state.
- Workflows - this is the main page to view the relationship between a bot, queue, system and any ancestors or descendants they may have.
- Saved Searches - this is the main search page for all bots, queues, and systems for the application. It allows you to bookmark specific searches so they can be more easily navigated in the future.
- Data Search (queue, bots, system) - This is the main search functionality that is in the header for each page.
- Event Trace - this is the main page to search for events in a specific Leo queue. 
- Event Trace Relationship View - This view shows how an event traveled through the bus
- Bot Dashboard - This is the main landing view when viewing a specific bot. It shows the bot_id, health status, the number of events written and read by the bot and which queue they were read from and written to, the current checkpoint, and execution stats.
- Bot Dashboard Code View - A mainly retired view that is a code-editor for the underlying bot logic. 
- Bot Dashboard Logs View - This view shows the most recent logs for a bot.
- Bot Dashboard Settings View - This view shows the settings for teh bot and allows the user to tweak those settings.
- Queue Dashboard - This is the main landing view when viewing a specific queue. It shows the queue_id, which bots are writing and reading to the queue, and some important stats.
- Queue Dashboard Events View with search and diff - Allows the user to search all the events with in the queue using a search bar. The search allows the user to inject raw javascript to aid in searching. The events are displayed in a table under the search bar. The diff view allows the user to compare what is considered `old-new` events to see what has changed on the event.
- Queue Dashboard settings view - This view shows the configured settings for the queue.
- Queue Dashboard Scheme View - shows the registered JSON Schema for the queue. 
- System Dashboard - this page is very similar to the Queue Dashboard page as a system is essentially a non-Leo managed queue. 
- System Dashboard Events View - provides the same functionality as the Queue Dashboard Events View
- System Dashboard Checksum View - 
- System Dashboard Cron View - 
- System Dashboard Webhook View - 
- System Dashboard Settings View - allows the user to view and configure settings for the system.
- SDK Page - Provides developers with SDK integration code samples and examples for different programming languages (e.g., NodeJS, PHP).
- Event Replay - Allows users to replay events from a specific checkpoint, helpful for debugging and recovery purposes.
- Manage Access - Interface for managing IP access control to the system.
- Data Source Connection - Dialog for connecting to various data sources.
- Message List - View for displaying and managing system messages.
- Reset Stream - Feature to reset event streams to a specific point.
- Saved Workflows - Ability to save and quickly access frequently used workflow configurations.
- Topics Management - Interface for managing message topics.
- Multiple Theme Support - The application supports different themes including default and invision themes.
- Mobile View Support - Responsive design for mobile device access.
- AWS Service Integration - Direct integration with AWS services including Kinesis, DynamoDB, S3, Lambda, etc.
- Charting and Visualization - Node charts and graph visualizations for monitoring system performance.
- Time Period Selection - Advanced time period selection tools for filtering events and logs by specific timeframes.
