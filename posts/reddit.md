# I built an AI coding orchestrator that lets me code from my phone, and now I'm questioning all my life choices

## TL;DR
Created systemprompt.io - an MCP server that orchestrates AI coding assistants (Claude, Gemini) with full git integration, Docker-based architecture, and native mobile apps. You can literally push production code while waiting in line for coffee. What have I done?

---

So there I was, sitting on the train, desperately trying to fix a production bug on my phone through a janky SSH app, when I thought: "There has to be a better way to let AI do my job for me while I'm mobile."

That's how **systemprompt.io** was born - and honestly, it might be the best terrible idea I've ever had.

## What is this madness?

Systemprompt Coding Agent is an MCP (Model Context Protocol) server that orchestrates AI coding assistants like Claude and Gemini. But here's where it gets interesting (or terrifying, depending on your perspective):

**The Three Horsemen of the Apocalypse:**
1. **Remote-First Architecture** - Run it on your server, access it from anywhere
2. **Native Mobile Apps** - iOS and Android apps that actually work (I'm as shocked as you are)
3. **Full MCP Protocol** - Because if you're going to over-engineer something, might as well go all the way

## The Architecture (or: How I Learned to Stop Worrying and Love the Docker)

Here's the fun part - it uses a three-tier architecture that I definitely didn't design at 3 AM:

- **Host Machine**: Where your actual code lives (and your hopes and dreams)
- **Daemon Bridge**: A Node.js process that acts as the middleman (like that friend who introduces you to bad decisions)
- **Docker Container**: The isolated MCP server (because containerization makes everything better, right?)

The kicker? All git operations happen on the host through the daemon. The Docker container is just vibing as a protocol server. Each task gets its own git branch, so when the AI inevitably writes `rm -rf /`, at least it's isolated!

## Why would anyone want this?

Picture this: You're at the dentist, getting a root canal, and suddenly Slack explodes. Production is down. Your manager is having a meltdown. But wait! You pull out your phone, open the systemprompt app, and tell Claude: "Fix the authentication service, it's probably that JWT thing again."

Five minutes later, while you're still drooling from novocaine, Claude has:
- Identified the issue
- Created a feature branch
- Fixed the bug
- Run the tests
- Created a pull request

You approve it with your non-numb thumb, and you're a hero. Your dentist is confused. Your manager is happy. You're questioning whether you even need to exist anymore.

## The Features Nobody Asked For

- **Git Branch-Based Task Execution**: Every task gets its own branch, because commit history should tell a story (usually a horror story)
- **Real-Time Streaming**: Watch the AI make mistakes in real-time, just like pair programming!
- **E2E Testing**: Tests that actually test things (revolutionary, I know)
- **Cloudflare Tunnel Support**: Access your local dev environment from anywhere, because security is just a state of mind
- **Task Management**: Track what the AI is doing, panic accordingly

## The Technical Bits (for my r/programming friends)

```typescript
// This is real code from the project, I swear
create_task({
  tool: "CLAUDECODE",
  branch: "feature/add-auth",
  instructions: "Add JWT authentication but make it secure this time"
})

// Claude: "I'm going to add bcrypt"
// Me: "Wait, not like that"
// Claude: *already pushed to main*
```

The whole thing is built with TypeScript, because I hate myself but not enough to use JavaScript. It supports both Claude Code CLI and Gemini CLI, so you can pick your poison.

## Security Warning (or: How to Give an AI Root Access to Your Life)

⚠️ **BIG SCARY WARNING**: This gives AI assistants full access to your system. They can read files, execute commands, and probably order pizza on your credit card. Use at your own risk, preferably in a VM, possibly in another country.

## But seriously, why?

Because sometimes you just want to see if you can. Because mobile development environments suck. Because I got tired of explaining to people that "no, I can't fix that bug right now, I'm at the grocery store." Now I can fix bugs WHILE buying groceries. 

Is this the future? Is this the end of software developers? Probably not, but it's fun to pretend.

## Want to try it? (You probably shouldn't, but...)

GitHub: [github.com/systemprompt-io/systemprompt-agent](https://github.com/systemprompt-io/systemprompt-agent)

Fair warning: The setup involves Docker, Node.js, and sacrificing a rubber duck to the coding gods. The mobile apps are on the App Store and Google Play, which still amazes me that they got approved.

If you're brave enough to try it, let me know how it goes. If you're brave enough to contribute, you're exactly the kind of chaotic good this project needs.

## Final Thoughts

Is systemprompt.io the best thing ever? Objectively, yes. Will it replace developers? Only the ones who were already being replaced by Stack Overflow. Should you use it in production? Absolutely not, but you will anyway.

Now if you'll excuse me, I need to go fix a bug that Claude just introduced while I was writing this post. From my phone. In the bathroom. Living the dream.

---

*Edit: Yes, I'm aware of the irony that an AI probably helped me write this post about an AI that writes code. We've reached peak recursion.*

*Edit 2: To the person who asked if it can fix CSS - nothing can fix CSS, not even AI.*