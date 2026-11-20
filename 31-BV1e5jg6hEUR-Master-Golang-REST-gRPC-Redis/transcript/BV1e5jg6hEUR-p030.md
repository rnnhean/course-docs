[00:00] hi and welcome from this lecture we will start working on notification block and as you can see here we have to end points one for mark the notifications as read and the other for getting the user all the notifications all right before we work it on that we want firstly to create the notifications but before all this we need on this lecture to create the notification model
[00:29] i just start doing this we can just came here inside models directory and then start create notification model.co right here we need to call the package and simply copy all this
[00:58] and paste it here remove this one or just leave it as it is change this to notification and we need to change this to user right and we need to cut this and paste it here
[01:27] very well after this one we need to have three strings one for the details all right I just change this to be small case and the one for
[01:55] the main new id or main user id we need to change it here on json and pessim all right and one for the target id
[02:21] and i just fix it as well all right what this main new id and this target id this main new id will refer to the user that want to create the notification for all right and this target id for example we have three situations where we will have a notification first when somebody start following our user
[02:51] so on that case the target ID will be for that user that start following our main user and the second and third when some user start create or start comment on our post or like our post on that case the target ID will be for the post very well
[03:19] or else we have let's just duplicate this one we want to know whether our user seeing that notification or not so let's just see as read it and this will be a pull in
[03:48] fix it here as rated all right we didn't need this validation so i just simply remove it i just remove all
[04:18] all right so what of that we should have created that we can copy it from any place just directly copy it from here and paste it here head save this will automatically get grab the time package and finally we want to have an object
[04:48] include our user data for example the person that start following us or comment or like our post so just call this user it will be an user object json just user pson will be also just user
[05:17] all right now we need to change this we can remove this one start changing this we should have name this user name and we should have the user avatar
[05:43] all right this can be an optimity so i just call this change it add comma and add optimity yep overall now we are ready to store create the notifications i just store
[06:11] Do this on the next lecture.
