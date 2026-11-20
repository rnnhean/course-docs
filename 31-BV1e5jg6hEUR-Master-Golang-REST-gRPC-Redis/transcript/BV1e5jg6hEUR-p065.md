[00:00] Hello and welcome on this lecture we will start working on the notification and related to our notification systems we do only have one error which is when a user create a notification it saves at the database with the sum of the user data so the idea here that we can just only save the user ID
[00:29] and update the user data or get the updated user data such as the name and the image URL all right to be synchronized with the initial state of the user very well now we need just to go to this and instead of have this user
[00:58] we need just to remove it i didn't need this anymore and below this one we just copy or duplicate it and call user ID i know that we can already use any one of these but we just keep it as it is to be assembled for us it will be a string
[01:27] user ID yep what should be remember for this will be for main user ID we can use this main new ID but let's just leave it as it is so this is the only change that we don't need to have okay anyang else I don't think we need the user structure anymore so we can just remove it
[01:54] and then go to the user controller go to this specific port that related to the user all right start from ago just you can say the user id second user
[02:21] second user id to hex and hit save and we do need to have the same hwad post controller where are we on the command yeah all right we can just remove this thing here
[02:50] and go down here say user ideal equal to this user ID hex okay now I just hit if we still of course have an error which will be here on like part since we do the same here on this part
[03:18] and we'll do the same thing we'll just remove this port go down here say other ID only call to this user ID X hit save and now we need to start target on the controller specifically the notification controller we have this one mark not
[03:46] the core notification as read and get user notifications all right just go to the top start work on that okay since that the expected response will be different than the model because it will represent
[04:12] the response structure with populated user data on each notification so we need to have a specific type for that I just start work on that we can call this notification response it will be a struct first of all
[04:40] we do have the id primitive object id and we need only to add the json as b id underscore id and we need type empty omit
[05:08] empty okay next we have details which will be a string the JSON will be details
[05:35] okay we need to duplicate this several times not too much anyway we have main UID we have Torbid UID we have Sreaded we have created that but just ignore it main UID
[06:05] MainUID KTORGIDID ID is ready. Okay, what next? Decorate it out. Why this goes?
[06:33] why this complain? not x4 but yeah, we need to have capital I then create it at time, not time, not tracker time just on will be created at
[07:02] okay need to close up this finally you need this simple object so user sorry sorry user user data we're going to create this right now just on just user came down here say type
[07:31] this user data it will be struct as all name it will be string just name and the image URL
[07:58] will be image URL ok now adjust hit save and now adjust start creating the helper function for populated user data
[08:24] OK, I just start by defining the function signature, while we can call this. CopyLate, notifications, what user did. OK, first to expect CTX, which will be contacts.
[08:54] notifications which will be a type of it will be models slice of models of notifications okay this will return notification response and obviously the error if there is an error yep all right
[09:23] now we need to define the variable and just call it response which will be a slice of notification response something's not right here we need to remove this v okay next we need to call user schema
[09:52] or collection name it schema was yours or name it collection anyway database dv collection users cool after that we need to have a loop let me just say force
[10:19] we want to loop through this notifications that we expected from here we didn't care about the first parameter we have notification we want to range on these notifications
[10:43] all right first we need to convert the user id strength to an object id okay so we can just say user obj id and the error we want this to equal to primitive object id no primitive object id from hex notification
[11:11] user ID okay what next we need to check f the error no equal to null in that case we want to
[11:32] simply skip the invalid user like this so we can just continue okay next we want to fetch the user data so we can just say world user
[11:58] models user model okay say errors or equal to user schema find on pass the contacts and then say PESO M
[12:28] under score ID object ID no sorry user object ID okay and then I can just came out here say decode pointer for this user all right
[12:57] then we can check if error sorry now equal to 0 on that case we can just say user.name will equal something like unknown user and user image URL
[13:26] just an empty string okay below this check now we need to create the response what fetched user lead so we can just say notification
[13:55] or equals to notification response where the ID or equal to notification ID details or equal to notification details main UID or equal to notification sorry
[14:25] modification main UID we just look at this after the main UID target ID after that is redid something about right here
[14:53] yes this very obvious if we go up here this should be pull in go down down down down down and after is read what we have created that notification sorry notification
[15:21] after that we have this user and now we can just add our user data name the populated user name image URL
[15:48] okay after that outside of this we need to say response append response with notification this all right and after all in this simple loop we can just return the response
[16:15] and now for the other we're all and now on work this we need to start work on get user notification one more time okay first part it will be the same thing construction, constructor, the filter mean
[16:43] your ID, auditory, your ID the update is not ok cursor defer yes until this point we are cool
[17:13] but we need this to claim and interrupt this operation on this point here say poppy with fresh user need all right all we can do is very simple we can just say response
[17:42] okay and error come up here and call our function and pass the contacts and pass notifications then check if error no equal to 0 under keys we can just return something like this I think
[18:09] I just copy this, paste it here I just copy this and paste it here before this I think we don't need to do something the front over here which is return the notification response instead
[18:36] all right here we need to say internal server error here we need to return error what error message error error we can also return a message for sampling the debugging operation
[19:05] failing or fail to popularly user-added okay and after all we can just return this response right now we can just save and we're ready to go but the problem is that the initial notification won't work by this way because yeah it do we have this user ID already
[19:35] that's amazing that's really amazing maybe this would happening with my tests previously so all I can do is to go for example for this user let copy
[19:59] we need to rerun our app go run main.go ok to be able to test this ok i have something that is not correct here but time model notification has no fields or method use of it ok
[20:25] all right this obviously happened because of the GRPC just go where is that this one GRPC client okay we will not use this anymore but anyway
[20:49] All right, I breathe the errors.
[21:18] because we are not have the object inside of the notification it's off will still go on error I think
[21:47] return no and do nothing for now okay you just say go run min.go okay and now we need to test this get user notification i will try g
[22:17] okay just hit sorry just hit this id and then execute okay look like this is works fine okay to give us the user id to be able to test it you need to start create a store for
[22:43] you need to remove the notification collection and start make like and comments and start following the user that you want to test the endpoint web in my case it is already works because I've already updated this before and I have an old data for that all right I think that's all I need to do
[23:12] now we can move on to the next lecture on the start use these updates on our front-end part so we just move on to the next lecture
[23:25] you
