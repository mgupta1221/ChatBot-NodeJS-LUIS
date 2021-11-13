// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const {
    ActivityHandler,
    MessageFactory,
    BotState,
    UserState,
    ConversationState
} = require('botbuilder');

const { MakeReservationDialog } = require('./ComponentDailogs/makeReservationDailog');

class RestaurantBot extends ActivityHandler {
    constructor(conversationState,
        userState) {
        super();

        this.conversationState = conversationState;
        this.userState = userState;

        // Below we created an accessor 
        // Each State Property accessor allows you to set or get the value of associated state property
        // We are only going to use ConvserationState in the solution, so below we only created accessor for the same
        // Notice the same is passed in the .run() method below when we initiate our Waterfall Dialog

        this.dialogState = conversationState.createProperty("dialogState");


        //creating global object for MakeResrvationDialog to access it to run() later
        this.makeReservationDialog = new MakeReservationDialog(this.conversationState, this.userState);

        //previous Intent accessor is to maintain the current Intent ,or, the current Topic
        this.previousIntent = this.conversationState.createProperty("previousIntent");

        //conversationData accessor is to handle rest of everything, here in our example we use this to maintain if Dialog has ended
        this.conversationData = this.conversationState.createProperty("conversationData");


        // See https://aka.ms/about-bot-activity-message to learn more about the message and other activity types.
        // onMessage() is to handle all incoming messages, you can decide which Dialog should the messgae should be routed to, here
        this.onMessage(async (context, next) => {

            //helper function created 
            await this.dispatchToIntentAsync(context);

            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });


        //called everytme a new Dialog is initiated
        this.onDialog(async (context, next) => {
            //After each step of the waterfall dialog, we need to save the conversationState
            //which in turn will save the Dialog state beacuse its a property accessor under ConservationState
            await this.conversationState.saveChanges(context, false);
            await this.userState.saveChanges(context, false);
            await next();
        });


        // called when a user joins the conversation(opens the bot)
        this.onMembersAdded(async (context, next) => {

            await this.sendWelcomeMessage(context);
            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });
    }

    async sendWelcomeMessage(turnContext) {
        const { activity } = turnContext;

        // Iterate over all new members added to the conversation.
        for (const idx in activity.membersAdded) {
            if (activity.membersAdded[idx].id !== activity.recipient.id) {
                const welcomeMessage = `Welcome to Restaurant Reservation Bot ${activity.membersAdded[idx].name}. `;
                await turnContext.sendActivity(welcomeMessage);
                await this.sendSuggestedActions(turnContext);
            }
        }
    }

    async sendSuggestedActions(turnContext) {
        var reply = MessageFactory.suggestedActions(['Make Reservation', 'Cancel Reservation', 'Restaurant Address'], 'What would you like to do today ?');
        await turnContext.sendActivity(reply);
    }

    async dispatchToIntentAsync(context) {


        let currentIntent = '';
        //getting the current values of accessors
        const previousIntent = await this.previousIntent.get(context, {});
        const conversationData = await this.conversationData.get(context, {});

        //checking if previously running topic/dialogue is still running and dialog has NOT ended
        if (previousIntent.intentName && conversationData.endDialog === false) {
            currentIntent = previousIntent.intentName;
        }
        else if (previousIntent.intentName && conversationData.endDialog === true) { //checking if previously running topic is still running and dialog has ended
            currentIntent = context.activity.text; //setting the current topic to what we have just recieved
        }
        else { // case when there is no running topic, like when we have just started so we set the acccessor here with default values
            currentIntent = context.activity.text; //setting the current topic to what we have just recieved, this will set to 'Make Reservaton' becuase that is first msg
            await this.previousIntent.set(context, { intentName: context.activity.text });

        }

        console.log(currentIntent)

        switch (currentIntent) {
            case 'Make Reservation':
                console.log("Inside Make Reservation Case");
                //before runing the dialog, setting value of endDialog as false
                // await this.conversationData.set(context, { endDialog: false });

                await this.makeReservationDialog.run(context, this.dialogState);
                // getting the endDialog state from 'makeReservationDialog.js' and setting it to conversation state
                conversationData.endDialog = await this.makeReservationDialog.isDialogComplete();
                break;

            default:
                console.log('Incoming messsage did not match the resrvation case');
                break;
        }




    }
}

module.exports.RestaurantBot = RestaurantBot;
