const { ComponentDialog, WaterfallDialog, DialogSet, DialogTurnStatus } = require("botbuilder-dialogs");

//Each prompt is an implementation of Dailog Class type  
const { ConfirmPrompt, ChoicePrompt, DateTimePrompt, NumberPrompt, TextPrompt } = require('botbuilder-dialogs');


// Each prompt is added to Dialogset with a specfic String Id hence we are creating the below string Ids
// So when your bot wants to start a dialog or a prompt within the dialog set it uses that String Id
const CHOICE_PROMPT = 'CHOICE_PROMPT';
const CONFIRM_PROMPT = 'CONFIRM_PROMPT';
const TEXT_PROMPT = 'TEXT_PROMPT';
const NUMBER_PROMPT = 'NUMBER_PROMPT';
const DATETIME_PROMPT = 'DATETIME_PROMPT';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
//created local variable to notify dialog end to main Bot i.e. myRestaurant
var endDialog = '';

class MakeReservationDialog extends ComponentDialog {

    constructor(conservsationState, userState) {
        super('makeReservationDialog');


        //Adding all prompts via StringIds 
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new ChoicePrompt(CHOICE_PROMPT));
        this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));
        this.addDialog(new NumberPrompt(NUMBER_PROMPT, this.noOfParticipantsValidator));// With Validator
        this.addDialog(new DateTimePrompt(DATETIME_PROMPT));

        //Adding WaterFall Dialog which is set of steps in sequence
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.firstStep.bind(this),  // Ask confirmation if user wants to make reservation?
            this.getName.bind(this),    // Get name from user
            this.getNumberOfParticipants.bind(this),  // Number of participants for reservation
            this.getDate.bind(this), // Date of reservation
            this.getTime.bind(this),  // Time of reservation
            this.confirmStep.bind(this), // Show summary of values entered by user and ask confirmation to make reservation
            this.summaryStep.bind(this)

        ]));




        this.initialDialogId = WATERFALL_DIALOG;


    }

    // accessor is a state property accessor, or, Dailog State property
    // main thing about this code is we are passing 'turnContext' to every new dialog aor dialogSet we are creating
    async run(turnContext, accessor, entities) {
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this); // adding all dialogs we created above in the constructor

        const dialogContext = await dialogSet.createContext(turnContext);//this tunContext is visible by ActivityHandler in our main dialog
        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty) {//checking if the dialog is already active when the user first land on this particular component dialog
            await dialogContext.beginDialog(this.id, entities); //if dialog is not already active, it wil start from the begnining
        }
    }


    async firstStep(step) {
        endDialog = false;

        step.values.noOfParticipants = step._info.options.NoOfParticipants;

        // Running a prompt here means the next WaterfallStep will be run when the users response is received.
        return await step.prompt(CONFIRM_PROMPT, 'Would you like to make a reservation?', ['yes', 'no']);

    }

    async getName(step) {

        console.log(step.result)
        if (step.result === true) {
            return await step.prompt(TEXT_PROMPT, 'In what name reservation is to be made?');
        }
        //If user selects 'No'
        if (step.result === false) {
            endDialog = true;
            await step.context.sendActivity('You choose not to go ahead with the reservation.');
            return await step.endDialog();
        }

    }

    async getNumberOfParticipants(step) {

        step.values.name = step.result;
        // If value of noOfParticpants is NOT received in 'entity' than only show this ialog to the user, 
        // else continue with the next step
        if (!step.values.noOfParticipants) {
            return await step.prompt(NUMBER_PROMPT, 'How many participants ( 1 - 150)?');
        }
        else {
            return await step.continueDialog();
        }
    }

    async getDate(step) {

        if (!step.values.noOfParticipants) //if value is not present than take it from previous Step's result
            step.values.noOfParticipants = step.result;

        return await step.prompt(DATETIME_PROMPT, 'On which date you want to make the reservation?')
    }

    async getTime(step) {

        step.values.date = step.result

        return await step.prompt(DATETIME_PROMPT, 'At what time?')
    }


    async confirmStep(step) {

        step.values.time = step.result

        var msg = ` You have entered following values: \n Name: ${step.values.name}\n Participants: ${step.values.noOfParticipants}\n Date: ${JSON.stringify(step.values.date)}\n Time: ${JSON.stringify(step.values.time)}`

        //sending the msg back to user first 
        await step.context.sendActivity(msg);

        return await step.prompt(CONFIRM_PROMPT, 'Are you sure that all values are correct and you want to make the reservation?', ['yes', 'no']);
    }

    async summaryStep(step) {

        if (step.result === true) {
            // Business 

            await step.context.sendActivity("Reservation successfully made. Your reservation id is : 12345678")
            endDialog = true;
            return await step.endDialog();

        }



    }


    async noOfParticipantsValidator(promptContext) {
        // This condition is our validation rule. You can also change the value at this point.
        return promptContext.recognized.succeeded && promptContext.recognized.value > 1 && promptContext.recognized.value < 150;
    }

    //method created to return the state of dialog if it is ended.
    async isDialogComplete() {
        return endDialog;
    }
}

module.exports.MakeReservationDialog = MakeReservationDialog;
