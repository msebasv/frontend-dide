import type { IOperationResult } from "@microsoft/power-apps/data";
import { dataSourcesInfo } from "../../../.power/schemas/appschemas/dataSourcesInfo";
import { getClient } from "@microsoft/power-apps/data";

export interface SharePointBlobItem {
  Id?: string;
  Name?: string;
  Path?: string;
  Link?: string;
  IsFolder?: boolean;
  DisplayName?: string;
  MediaType?: string;
  ItemId?: number;
  FileRef?: string;
  "{Link}"?: string;
  "{Path}"?: string;
  "{FilenameWithExtension}"?: string;
  "{IsFolder}"?: boolean;
  "{Identifier}"?: string;
  FSObjType?: number;
  FileLeafRef?: string;
}

export class SharePointOnlineService {
  private static readonly dataSourceName = "sharepointonline";

  private static readonly client = getClient(dataSourcesInfo);

  public static async GetFolderMetadataByPath(params: {
    dataset: string;
    path: string;
  }): Promise<IOperationResult<SharePointBlobItem>> {
    return SharePointOnlineService.client.executeAsync<
      { dataset: string; path: string },
      SharePointBlobItem
    >({
      connectorOperation: {
        tableName: SharePointOnlineService.dataSourceName,
        operationName: "GetFolderMetadataByPath",
        parameters: params,
      },
    });
  }

  public static async ListFolder(params: {
    dataset: string;
    id: string;
  }): Promise<IOperationResult<SharePointBlobItem[]>> {
    return SharePointOnlineService.client.executeAsync<
      { dataset: string; id: string },
      SharePointBlobItem[]
    >({
      connectorOperation: {
        tableName: SharePointOnlineService.dataSourceName,
        operationName: "ListFolder",
        parameters: params,
      },
    });
  }

  public static async GetFileItems(params: {
    dataset: string;
    table: string;
    folderPath?: string;
    viewScopeOption?: string;
    $filter?: string;
    $top?: number;
  }): Promise<IOperationResult<{ value?: SharePointBlobItem[] }>> {
    return SharePointOnlineService.client.executeAsync<
      {
        dataset: string;
        table: string;
        folderPath?: string;
        viewScopeOption?: string;
        $filter?: string;
        $top?: number;
      },
      { value?: SharePointBlobItem[] }
    >({
      connectorOperation: {
        tableName: SharePointOnlineService.dataSourceName,
        operationName: "GetFileItems",
        parameters: {
          dataset: params.dataset,
          table: params.table,
          folderPath: params.folderPath,
          viewScopeOption: params.viewScopeOption,
          $filter: params.$filter,
          $top: params.$top,
        },
      },
    });
  }

  public static async GetFileContent(params: {
    dataset: string;
    id: string;
    inferContentType?: boolean;
  }): Promise<IOperationResult<string>> {
    return SharePointOnlineService.client.executeAsync<
      {
        dataset: string;
        id: string;
        inferContentType?: boolean;
      },
      string
    >({
      connectorOperation: {
        tableName: SharePointOnlineService.dataSourceName,
        operationName: "GetFileContent",
        parameters: {
          dataset: params.dataset,
          id: params.id,
          inferContentType: params.inferContentType ?? true,
        },
      },
    });
  }

  public static async GetFileContentByPath(params: {
    dataset: string;
    path: string;
    inferContentType?: boolean;
  }): Promise<IOperationResult<string>> {
    return SharePointOnlineService.client.executeAsync<
      {
        dataset: string;
        path: string;
        inferContentType?: boolean;
      },
      string
    >({
      connectorOperation: {
        tableName: SharePointOnlineService.dataSourceName,
        operationName: "GetFileContentByPath",
        parameters: {
          dataset: params.dataset,
          path: params.path,
          inferContentType: params.inferContentType ?? true,
        },
      },
    });
  }
}
