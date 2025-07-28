/**
 * Helper service for rebuild error responses.
 */
export class RebuildOperationsHelperService {
  /**
   * Create rebuild error response.
   * @param message - Error message.
   * @param tablesDropped - Number of tables dropped.
   * @param schemasFound - Number of schemas found.
   * @param filesImported - Number of files imported.
   * @param filesSkipped - Number of files skipped.
   * @returns Error response.
   */
  static createRebuildError(
    message: string | undefined,
    tablesDropped: number,
    schemasFound: number,
    filesImported: number,
    filesSkipped: number = 0
  ): {
    success: boolean;
    message: string;
    details: {
      tablesDropped: number;
      schemasFound: number;
      filesImported: number;
      filesSkipped: number;
      errors: string[];
    };
  } {
    return {
      success: false,
      message: message ?? 'Operation failed',
      details: {
        tablesDropped,
        schemasFound,
        filesImported,
        filesSkipped,
        errors: message === undefined
          ? ['Operation failed']
          : [message]
      }
    };
  }
}
