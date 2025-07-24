/**
 * User sessions command
 */

import { Command } from 'commander';
import type { UsersModule } from '../index.js';

export function createSessionsCommand(module: UsersModule): Command {
  const cmd = new Command('sessions')
    .description('Manage user sessions')
    .option('-u, --user <id>', 'Filter by user ID')
    .option('-r, --revoke <sessionId>', 'Revoke specific session')
    .option('--revoke-all', 'Revoke all sessions for user')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        // Handle revoke operations
        if (options.revokeAll && options.user) {
          await module.revokeUserSessions(options.user);
          console.log(`\nAll sessions revoked for user ${options.user}\n`);
          return;
        }
        
        if (options.revoke && options.user) {
          await module.revokeUserSessions(options.user, options.revoke);
          console.log(`\nSession ${options.revoke} revoked\n`);
          return;
        }
        
        // List sessions
        const sessions = await module.getUserSessions(options.user);
        
        if (options.json) {
          console.log(JSON.stringify(sessions, null, 2));
        } else {
          if (sessions.length === 0) {
            console.log('No sessions found');
            return;
          }
          
          // Group by user if showing all
          if (!options.user) {
            const byUser = sessions.reduce((acc, session) => {
              if (!acc[session?.userId]) {acc[session?.userId] = [];}
              acc[session?.userId].push(session);
              return acc;
            }, {} as Record<string, typeof sessions>);
            
            for (const [userId, userSessions] of Object.entries(byUser)) {
              console.log(`\nUser: ${userId}`);
              console.log('Sessions:');
              printSessionTable(userSessions);
            }
          } else {
            console.log('\nSessions:');
            printSessionTable(sessions);
          }
          
          console.log(`\nTotal: ${sessions.length} session(s)\n`);
        }
      } catch (error: any) {
        console.error('Error managing sessions:', error.message);
        process.exit(1);
      }
    });
  
  return cmd;
}

function printSessionTable(sessions: any[]) {
  console.log('ID                                Active  IP Address       Expires                   Last Activity');
  console.log('--------------------------------  ------  ---------------  ------------------------  ------------------------');
  
  sessions.forEach(session => {
    const id = session?.id.substring(0, 32);
    const active = session?.isActive ? 'Yes' : 'No';
    const ip = (session?.ipAddress || 'Unknown').substring(0, 15).padEnd(15);
    const expires = new Date(session?.expiresAt).toISOString();
    const lastActivity = new Date(session?.lastActivityAt).toISOString();
    
    console.log(`${id}  ${active.padEnd(6)}  ${ip}  ${expires}  ${lastActivity}`);
  });
}