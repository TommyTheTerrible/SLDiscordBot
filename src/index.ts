// SL to Discord bot
// This module watches group chat messages and sends them to Webhooks, such as those used by Discord text channels.
// TommyTheTerrible 

import * as path from 'path';
import * as fs from 'fs';

import Signals = NodeJS.Signals;
import Timeout = NodeJS.Timeout;

import { LoginResponse } from '@caspertech/node-metaverse';
import { Bot } from '@caspertech/node-metaverse';
import { LoginParameters } from '@caspertech/node-metaverse';
import { BotOptionFlags } from '@caspertech/node-metaverse';
import { GroupChatEvent } from '@caspertech/node-metaverse';
import { GroupNoticeEvent } from '@caspertech/node-metaverse';
import { InstantMessageEvent } from '@caspertech/node-metaverse';
import { ChatSourceType } from '@caspertech/node-metaverse';
import { InstantMessageEventFlags } from '@caspertech/node-metaverse';
import { LureEvent } from '@caspertech/node-metaverse';
//import { UUID } from '@caspertech/node-metaverse';


import fetch from 'node-fetch';


class SLDiscordBot
{
    protected masterAvatar = 'd1cd5b71-6209-4595-9bf0-771bf689ce00';
    protected isConnected = false;
    protected isConnecting = false;
    protected loginResponse?: LoginResponse;    

    protected gcInterval;
    protected gcRefreshTime = 300000; // default is 300000, aka five minutes in milliseconds.

    protected bot: Bot;
    private reconnectTimer?: Timeout;

    protected webhooksFilename = path.resolve(__dirname, "../config/webhooks.json");

    protected webhooks = require(this.webhooksFilename);

    constructor()
    {
        const loginParameters = new LoginParameters();
        const parameters = require(path.join(__dirname, '..', '/config/loginParameters.json'));

        this.__LoadWebhooks();

        // Watch Webhooks json for changes
        fs.watchFile(this.webhooksFilename, (curr, prev) => {
            console.log(`Webhooks.json updated at ${curr.mtime}. Last update was at ${prev.mtime}.`);            
            this.__LoadWebhooks();
          });
  

        loginParameters.firstName = parameters.firstName;
        loginParameters.lastName = parameters.lastName;
        loginParameters.password = parameters.password;
        loginParameters.start = parameters.start;

        // If you don't intend to use the object store (i.e you have no interest in inworld objects, textures, etc,
        // using nmv.BotOptionFlags.LiteObjectStore will drastically reduce the footprint and CPU usage.
        //
        // The full object store has a full searchable rtree index, the lite does not.
        //
        // For the minimum footprint, use :
        //
        const options = BotOptionFlags.LiteObjectStore | BotOptionFlags.StoreMyAttachmentsOnly;

        //const options = BotOptionFlags.None;

        this.bot = new Bot(loginParameters, options);

        // This will tell the bot to keep trying to teleport back to the 'stay' location.
        // You can specify a region and position, such as:
        // bot.stayPut(true, 'Izanagi', new nmv.Vector3([128, 128, 21]));
        // Note that the 'stay' location will be updated if you request or accept a lure (a teleport).
        // If no region is specified, it will be set to the region you log in to.
        this.bot.stayPut(true);

    }

    private async __LoadWebhooks() {
        this.webhooks = JSON.parse(fs.readFileSync(this.webhooksFilename, "utf8"));
    }

    public async run(): Promise<void>
    {
        const exitHandler = async(options: { exit?: boolean }, err: Error | number | Signals) =>
        {
            if (err && err instanceof Error)
            {
                console.log(err.stack);
            }
            if (this.isConnected)
            {
                console.log('Disconnecting');
                try
                {
                    await this.bot.close();
                }
                catch (error)
                {
                    console.error('Error when closing client:');
                    console.error(error);
                }
                process.exit();
                return;
            }
            if (options.exit)
            {
                process.exit();
            }
        }



        // Do something when app is closing
        process.on('exit', exitHandler.bind(this, {}));

        // Catches ctrl+c event
        process.on('SIGINT', exitHandler.bind(this, { exit: true }));

        // Catches service restart event
        process.on('SIGTERM', exitHandler.bind(this, { exit: true }));
	
	// Catches "kill pid"
        process.on('SIGUSR1', exitHandler.bind(this, { exit: true }));
        process.on('SIGUSR2', exitHandler.bind(this, { exit: true }));

        // Catches uncaught exceptions
        process.on('uncaughtException', exitHandler.bind(this, { exit: true }));

        await this.login();
    }

    private async login(): Promise<void>
    {
        if (this.isConnecting)
        {
            return;
        }
        this.isConnecting = true;
        try
        {
            if (this.reconnectTimer !== undefined)
            {
                clearInterval(this.reconnectTimer);
            }
            this.reconnectTimer = setInterval(this.reconnectCheck.bind(this), 60000);

            console.log('Logging in..');
            this.loginResponse = await this.bot.login();

            console.log('Login complete');

            // Establish circuit with region
            await this.bot.connectToSim();

            console.log('Waiting for event queue');
            await this.bot.waitForEventQueue();

            this.isConnected = true;
        }
        finally
        {
            this.isConnecting = false;
        }
        return this.connected();
    }

    private async reconnectCheck(): Promise<void>
    {
        if (!this.isConnected)
        {
            await this.login();
        }
    }

    private async connected(): Promise<void>
    {
        this.bot.clientEvents.onDisconnected.subscribe((event) =>
        {
            if (event.requested)
            {
                if (this.reconnectTimer !== undefined)
                {
                    clearInterval(this.reconnectTimer);
                }
            }
            this.isConnected = false;
            console.log('Disconnected from simulator: ' + event.message);
        });
        await this.onConnected();
    }

    // @ts-ignore
    private async close(): Promise<void>
    {
        if (this.reconnectTimer !== undefined)
        {
            clearInterval(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
        return this.bot.close();
    }


    async onConnected(): Promise<void>
    {

        this.bot.clientEvents.onInstantMessage.subscribe(this.onInstantMessage.bind(this));

        this.bot.clientEvents.onGroupChat.subscribe(this.onGroupChat.bind(this));

	this.bot.clientEvents.onGroupNotice.subscribe(this.onGroupNotice.bind(this));

	this.bot.clientEvents.onLure.subscribe(this.onLure.bind(this));

	gcInterval = setInterval(RefreshGroupChatSessions, gcRefreshTime);

    }

    async onGroupChat(event: GroupChatEvent): Promise<void>
    {

        var account_first_name = event.fromName.split(" ")[0];
        var account_last_name = event.fromName.split(" ")[1];
        var account_photo;

        if(account_last_name == "Resident"){
                account_photo = "https://my-secondlife-agni.akamaized.net/users/"+ account_first_name.toLowerCase() +"/sl_image.png";
        } else {
                account_photo = "https://my-secondlife-agni.akamaized.net/users/"+ account_first_name.toLowerCase() +"."+                       account_last_name.toLowerCase() + "/thumb_sl_image.png";
        }

	var webhook = this.webhooks[event.groupID.toString()];
	var chatmessage = event.message.replace('@everyone','').replace('@here','');

	if(webhook) await this.SendMessageWebhook(event.fromName, account_photo, chatmessage, webhook);
	
        //console.log('Group chat: ' + event.fromName + ': ' + event.message + ' sent to ' + webhook + ' ' + account_photo);

    }

    async onGroupNotice(event: GroupNoticeEvent): Promise<void>
    {

        var account_first_name = event.fromName.split(" ")[0];
        var account_last_name = event.fromName.split(" ")[1];
        var account_photo;

        if(account_last_name == "Resident"){
                account_photo = "https://my-secondlife-agni.akamaized.net/users/"+ account_first_name.toLowerCase() +"/sl_image.png";
        } else {
                account_photo = "https://my-secondlife-agni.akamaized.net/users/"+ account_first_name.toLowerCase() +"."+                       account_last_name.toLowerCase() + "/thumb_sl_image.png";
        }

        var webhook = this.webhooks[event.groupID.toString()];
        var noticeMessage = event.message.replace('@everyone','').replace('@here','');
	var noticeSubject = event.subject;


        if(webhook) await this.SendNoticeWebhook(event.fromName, account_photo, noticeSubject, noticeMessage, webhook);

        //console.log('Group chat: ' + event.fromName + ': ' + event.message + ' sent to ' + webhook + ' ' + account_photo);

    }


    async onInstantMessage(event: InstantMessageEvent)
    {
        if (event.source === ChatSourceType.Agent)
        {
            if (!(event.flags & InstantMessageEventFlags.startTyping || event.flags & InstantMessageEventFlags.finishTyping))
            {
                // typeInstantMessage will emulate a human-ish typing speed
                await this.bot.clientCommands.comms.typeInstantMessage(event.from, 'Thanks for the message! This account is a scripted agent (bot), so cannot reply to your query. Sorry!');

                // sendInstantMessage will send it instantly
                await this.bot.clientCommands.comms.sendInstantMessage(event.from, 'Of course I still love you!');
            }
        }
    }

    async onLure(lureEvent: LureEvent)
    {
        try
        {
            const regionInfo = await this.bot.clientCommands.grid.getRegionMapInfo(lureEvent.gridX / 256, lureEvent.gridY / 256);
            if (lureEvent.from.toString() === this.masterAvatar)
            {
                console.log('Accepting teleport lure to ' + regionInfo.block.name + ' (' + regionInfo.avatars.length + ' avatar' + ((regionInfo.avatars.length === 1) ? '' : 's') + '' +
                    ' present) from ' + lureEvent.fromName + ' with message: ' + lureEvent.lureMessage);
                try
                {
                    await this.bot.clientCommands.teleport.acceptTeleport(lureEvent);
                }
                catch (error)
                {
                    console.error('Teleport error:');
                    console.error(error);
                }
            }
            else
            {
                console.log('Ignoring teleport lure to ' + regionInfo.block.name + ' (' + regionInfo.avatars.length + ' avatar' + ((regionInfo.avatars.length === 1) ? '' : 's') + ' ' +
                    'present) from ' + lureEvent.fromName + ' with message: ' + lureEvent.lureMessage);
            }
        }
        catch (error)
        {
            console.error('Failed to get region map info:');
            console.error(error);
        }
    }

    async SendMessageWebhook(userName:string, userImage:string, userMessage:string, webhookURL:string) {

        let fetchBody = JSON.stringify({
                username: userName,
                avatar_url: userImage,
                content: userMessage
                });

        fetch(webhookURL,{
                method: 'post',
                headers: {
                'Content-Type': 'application/json',
                },
                body: fetchBody
                }
        );
    }

    async SendNoticeWebhook(userName:string, userImage:string, noticeSubject:string, noticeMessage:string, webhookURL:string) {

        let fetchBody = JSON.stringify({
                username: userName,
                avatar_url: userImage,
                embeds: [{
			color: 1127128,
			title: noticeSubject,
			description: noticeMessage
		}]
	});

        fetch(webhookURL,{
                method: 'post',
                headers: {
                'Content-Type': 'application/json',
                },
                body: fetchBody
                }
        );
    }

    // Sends group chat session start to each group in webhook.
    // This repeats every so many minutes to keep connection to group chats.
    async RefreshGroupChatSessions() {
	for (const [key, value] of Object.entries(this.webhooks)) {
	  await this.bot.clientCommands.comms.startGroupChatSession(key, '');
	}
    }


}



new SLDiscordBot().run().then(() => {}).catch((err: Error) => { console.error(err) });

