-- Initialize prompts database
-- This file is run when the module is first loaded

-- Insert default prompts
INSERT OR IGNORE INTO prompts (name, description, arguments, messages) VALUES
  (
    'bugfix',
    'Fix a bug in the code based on error message and context',
    '[{"name": "errormessage", "description": "The error message to fix", "required": true}, {"name": "file_path", "description": "Path to the file with the bug", "required": false}]',
    '[{"role": "user", "content": {"type": "text", "text": "I need help fixing this bug:\n\nError: {{errormessage}}\n\nFile: {{file_path}}\n\nPlease analyze the error and provide a solution."}}]'
  ),
  (
    'reactcomponent', 
    'Generate a React component based on requirements',
    '[{"name": "componentname", "description": "Name of the React component", "required": true}, {"name": "requirements", "description": "Component requirements and features", "required": true}]',
    '[{"role": "user", "content": {"type": "text", "text": "Create a React component named {{componentname}} with the following requirements:\n\n{{requirements}}\n\nPlease provide a complete, functional React component with proper TypeScript types."}}]'
  ),
  (
    'unittest',
    'Generate unit tests for a given function or module',
    '[{"name": "code", "description": "The code to write tests for", "required": true}, {"name": "framework", "description": "Testing framework to use", "required": false}]',
    '[{"role": "user", "content": {"type": "text", "text": "Please write comprehensive unit tests for the following code:\n\n```\n{{code}}\n```\n\nTesting framework: {{framework}}\n\nInclude edge cases and proper assertions."}}]'
  );