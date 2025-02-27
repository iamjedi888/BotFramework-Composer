// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { v4 as uuidv4 } from 'uuid';
import type { AxiosInstance, AxiosResponse } from 'axios';
import { axios, createAxios } from '@bfc/shared/lib/axios';
import { createStore as createWebChatStore } from 'botframework-webchat-core';
import { createDirectLine } from 'botframework-webchat';
import moment from 'moment';
import formatMessage from 'format-message';

import { BotSecret, WebChatMode, User, ChatData, StartConversationPayload } from '../types';

export const getDateTimeFormatted = (): string => {
  return moment().local().format('YYYY-MM-DD HH:mm:ss');
};

export class ConversationService {
  private directlineHostUrl: string;
  private composerApiClient: AxiosInstance;
  private restServerForWSPort = -1;

  constructor(directlineHostUrl: string) {
    this.directlineHostUrl = directlineHostUrl.endsWith('/') ? directlineHostUrl.slice(0, -1) : directlineHostUrl;
    this.composerApiClient = createAxios({
      baseURL: directlineHostUrl,
    });
    this.setUpConversationServer();
  }

  private generateUniqueId = () => {
    return uuidv4().toString();
  };

  private async conversationUpdate(
    oldConversationId: string,
    newConversationId: string,
    userId: string,
    activeLocale: string,
    secret: BotSecret
  ) {
    const url = `${this.directlineHostUrl}/conversations/${oldConversationId}/updateConversation`;
    return axios.put(
      url,
      {
        conversationId: newConversationId,
        userId,
        locale: activeLocale,
        msaAppId: secret.msAppId,
        msaPassword: secret.msPassword,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  private getUser(): User {
    return {
      id: uuidv4(),
      name: 'User',
      role: 'user',
    };
  }

  private async fetchDirectLineObject(
    conversationId: string,
    directLineOptions: { mode: WebChatMode; endpointId: string; userId: string }
  ) {
    const options = {
      conversationId,
      ...directLineOptions,
    };
    const secret = btoa(JSON.stringify(options));
    const directLine = createDirectLine({
      token: 'emulatorToken',
      conversationId,
      secret,
      domain: `${this.directlineHostUrl}/v3/directline`,
      webSocket: true,
      streamUrl: `ws://localhost:${this.restServerForWSPort}/ws/conversation/${conversationId}`,
    });
    return directLine;
  }

  private startConversation(payload: StartConversationPayload): Promise<Response> {
    return this.composerApiClient.post(
      `v3/conversations`,
      {
        ...payload,
        bot: {
          id: uuidv4().toString(),
          name: 'Bot',
          role: 'bot',
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  public async startNewConversation(
    botUrl: string,
    secret: BotSecret,
    projectId: string,
    activeLocale: string
  ): Promise<ChatData> {
    const webChatMode = 'livechat';
    const user = this.getUser();

    const resp: any = await this.startConversation({
      botUrl,
      channelServiceType: 'public',
      members: [user],
      mode: webChatMode,
      msaAppId: secret.msAppId,
      msaPassword: secret.msPassword,
      locale: activeLocale,
    });

    const conversationId: string = resp.data.conversationId;
    const endpointId: string = resp.data.endpointId;

    const directline = await this.fetchDirectLineObject(conversationId, {
      mode: webChatMode,
      endpointId: endpointId,
      userId: user.id,
    });

    const webChatStore: unknown = createWebChatStore({});
    return {
      directline,
      webChatMode,
      projectId,
      user,
      conversationId,
      webChatStore,
    };
  }

  public async restartConversation(
    oldChatData: ChatData,
    requireNewUserID: boolean,
    activeLocale: string,
    secret: BotSecret
  ) {
    if (oldChatData.directline) {
      oldChatData.directline.end();
    }

    const conversationId = `${this.generateUniqueId()}|${oldChatData.webChatMode}`;

    let user = oldChatData.user;
    if (requireNewUserID) {
      user = this.getUser();
    }

    const resp = await this.conversationUpdate(
      oldChatData.conversationId,
      conversationId,
      user.id,
      activeLocale,
      secret
    );
    const { endpointId } = resp.data;
    const directline = await this.fetchDirectLineObject(conversationId, {
      mode: oldChatData.webChatMode,
      endpointId: endpointId,
      userId: user.id,
    });
    const webChatStore = createWebChatStore({});

    return {
      directline,
      webChatMode: oldChatData.webChatMode,
      projectId: oldChatData.projectId,
      user,
      conversationId,
      webChatStore,
    };
  }

  public sendInitialActivity(conversationId: string, members: [User]) {
    try {
      const url = `${this.directlineHostUrl}/v3/directline/conversations/${conversationId}/activities`;
      const activity = {
        type: 'conversationUpdate',
        membersAdded: members,
        membersRemoved: [],
      };
      return axios.post(url, activity, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (ex) {
      const response: AxiosResponse = ex.response;
      const err = {
        timestamp: getDateTimeFormatted(),
        route: 'conversations/ws/port',
        status: response.status,
        logType: 'Error',
        message: formatMessage('An error occurred sending conversation update activity to the bot'),
      };
      throw err;
    }
  }

  public async getTranscriptsData(conversationId: string) {
    return await this.composerApiClient.get(`/conversations/${conversationId}/transcripts`);
  }

  public async saveTranscriptToDisk(conversationId: string, fileSavePath: string) {
    try {
      await this.composerApiClient.post(`/conversations/${conversationId}/saveTranscript`, {
        fileSavePath,
      });
    } catch (ex) {
      const response: AxiosResponse = ex.response;
      const err = {
        timestamp: getDateTimeFormatted(),
        route: response.request?.path ?? '',
        status: response.status,
        logType: 'Error',
        message: formatMessage('An error occurred trying to save the transcript to disk'),
      };
      return err;
    }
  }

  public async setUpConversationServer() {
    const resp = await this.composerApiClient.get(`conversations/ws/port`);
    const { port } = resp.data;
    this.restServerForWSPort = port;
    return port;
  }
}
