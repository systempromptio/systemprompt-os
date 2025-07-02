/**
 * @fileoverview Reddit post creation prompt for engaging community announcements
 * @module handlers/prompts/reddit-post
 */

import type { Prompt } from '@modelcontextprotocol/sdk/types.js';

/**
 * Prompt for creating Reddit posts
 */
export const CREATE_REDDIT_POST_PROMPT: Prompt = {
  name: 'create_reddit_post',
  description: 'Write a playful Reddit post introducing the Systemprompt Coding Agent project',
  arguments: [
    {
      name: 'subreddit',
      description: 'Target subreddit for the post (e.g., r/programming, r/webdev)',
      required: false,
    },
    {
      name: 'tone',
      description: 'Tone of the post (playful, informative, excited)',
      required: false,
    }
  ],
  messages: [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `# Reddit Post Creation Task

## Post Requirements
- **Target Subreddit**: {{subreddit}}
- **Tone**: {{tone}}
- **Output File**: ./posts/reddit.md

## Instructions

Write an engaging Reddit post that playfully introduces the Systemprompt Coding Agent project. The post should:

### 1. Title Creation
- Create a catchy, attention-grabbing title
- Keep it under 300 characters
- Make it relevant to the subreddit audience
- Include something intriguing or humorous
- Avoid clickbait but make it compelling

### 2. Post Content Structure

**Opening Hook** (1-2 sentences):
- Start with something relatable or amusing
- Connect with developers' daily experiences
- Set a playful, friendly tone

**Project Introduction** (2-3 paragraphs):
- Explain what Systemprompt Coding Agent is
- Highlight key features in an accessible way
- Use analogies or metaphors that developers will appreciate
- Keep technical details light but accurate

**Key Features to Highlight**:
- MCP (Model Context Protocol) server implementation
- Docker-based architecture with host bridge
- Git branch-based task execution
- Support for Claude and Gemini AI assistants
- E2E testing capabilities
- Tunnel support for remote access

**Why It's Cool** (1-2 paragraphs):
- Emphasize the problem it solves
- Share potential use cases
- Make it relatable to common developer pain points
- Add a touch of humor about AI pair programming

**Technical Details** (Optional, based on subreddit):
- Brief architecture overview
- Interesting implementation details
- Any unique challenges solved

**Call to Action**:
- Link to the GitHub repository
- Invite contributions or feedback
- Suggest trying it out
- Maybe add a fun challenge or question

### 3. Formatting Guidelines
- Use Reddit markdown formatting
- Include code blocks sparingly if needed
- Add relevant links
- Consider using bullet points for readability
- Include a TL;DR at the beginning or end

### 4. Tone and Style
- Keep it conversational and approachable
- Add programmer humor where appropriate
- Avoid being overly promotional
- Be genuine and enthusiastic
- Include personal touches or anecdotes

### 5. Example Structure Template

\\\`\\\`\\\`markdown
## [Catchy Title Here]

**TL;DR**: Brief one-liner about the project

Hey r/{{subreddit}}! 

[Opening hook about a relatable developer experience]

[Project introduction with personality]

### What makes it special:
- Feature 1 (explained playfully)
- Feature 2 (with a fun analogy)
- Feature 3 (highlighting the cool factor)

[Why you built it / problem it solves]

[Technical bits for the curious]

[Invitation to try/contribute]

**GitHub**: [link]
**Docs**: [link]

[Closing question or call for feedback]
\\\`\\\`\\\`

### 6. Subreddit Considerations
- r/programming: More technical details, architecture focus
- r/webdev: Practical applications, workflow improvements
- r/coding: Beginner-friendly explanations
- r/devops: Docker and deployment aspects
- r/artificial: AI integration focus

### Output Requirements
1. Save the complete Reddit post to \`./posts/reddit.md\`
2. Include the title as an H1 header
3. Format properly for Reddit markdown
4. Make it engaging and shareable
5. Proofread for typos and clarity

Remember: The goal is to share something cool with the community, not to advertise. Make it feel like you're excitedly telling friends about a fun project you've been working on!`,
      },
    },
  ],
};

/**
 * Collection of Reddit post prompts
 */
export const REDDIT_POST_PROMPTS = [CREATE_REDDIT_POST_PROMPT];