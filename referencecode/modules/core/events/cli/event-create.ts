import { Command } from 'commander';
import { Container } from 'typedi';
import { EventService } from '../services/event.service.js';
import { EventPriority, EventTriggerType } from '../types/index.js';

export function createEventCreateCommand(): Command {
  const command = new Command('event:create');

  command
    .description('Create a new event')
    .requiredOption('-n, --name <name>', 'Event name')
    .requiredOption('-t, --type <type>', 'Event type (e.g., webhook.received, task.execute)')
    .option('-p, --priority <priority>', 'Event priority (low, normal, high, critical)', 'normal')
    .option('-d, --data <json>', 'Event data as JSON string', '{}')
    .option('-m, --metadata <json>', 'Event metadata as JSON string', '{}')
    .option(
      '--trigger-type <type>',
      'Trigger type (manual, scheduled, webhook, system, api)',
      'manual',
    )
    .option('--trigger-id <id>', 'Trigger ID')
    .option('--schedule-at <datetime>', 'Schedule event for future execution (ISO 8601 format)')
    .action(async (options) => {
      try {
        const eventService = Container.get(EventService);

        // Parse JSON data
        let data = {};
        let metadata = {};

        try {
          data = JSON.parse(options.data);
        } catch (error) {
          console.error('Invalid JSON for data:', error);
          process.exit(1);
        }

        try {
          metadata = JSON.parse(options.metadata);
        } catch (error) {
          console.error('Invalid JSON for metadata:', error);
          process.exit(1);
        }

        // Validate priority
        const priority = options.priority.toLowerCase() as EventPriority;
        if (!Object.values(EventPriority).includes(priority)) {
          console.error(`Invalid priority: ${options.priority}`);
          console.error(`Valid priorities: ${Object.values(EventPriority).join(', ')}`);
          process.exit(1);
        }

        // Validate trigger type
        const triggerType = options.triggerType as EventTriggerType;
        if (!Object.values(EventTriggerType).includes(triggerType)) {
          console.error(`Invalid trigger type: ${options.triggerType}`);
          console.error(`Valid trigger types: ${Object.values(EventTriggerType).join(', ')}`);
          process.exit(1);
        }

        // Parse scheduled time if provided
        let scheduledAt: Date | undefined;
        if (options.scheduleAt) {
          scheduledAt = new Date(options.scheduleAt);
          if (isNaN(scheduledAt.getTime())) {
            console.error(
              'Invalid schedule time format. Use ISO 8601 format (e.g., 2024-01-01T10:00:00Z)',
            );
            process.exit(1);
          }
        }

        // Create the event
        const eventData: Parameters<typeof eventService.createEvent>[0] = {
          name: options.name,
          type: options.type,
          priority,
          data,
          metadata,
          trigger_type: triggerType,
        };
        
        if (options.triggerId) {
          eventData.trigger_id = options.triggerId;
        }
        
        if (scheduledAt) {
          eventData.scheduled_at = scheduledAt;
        }
        
        const event = await eventService.createEvent(eventData);

        console.log('Event created successfully:');
        console.log(JSON.stringify(event, null, 2));
      } catch (error) {
        console.error('Failed to create event:', error);
        process.exit(1);
      }
    });

  return command;
}
