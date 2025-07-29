1. Run npm run lint to identify files with linting errors
2. Write the output to a file for analysis
3. Get the list of files with errors from the lint output
4. Process files one at a time (maximum 10 iterations):
   - Take the first file from the list
   - Fix ALL lint errors in that file
   - Verify the file has 0 lint errors before moving to the next
   - Remove the completed file from the list
5. When the current list is complete, run npm run lint again to identify any new files with errors
6. Repeat the process until all files conform to linting standards or 10 iterations are reached
7. If issues remain after 10 iterations, comment in files with remaining issues that can be fixed manually and move on