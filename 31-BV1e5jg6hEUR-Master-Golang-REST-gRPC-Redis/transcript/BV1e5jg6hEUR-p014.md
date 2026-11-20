[00:00] hi and welcome on this lecture we will restore the following endpoint very well just store go ahead to user routes and store game down here and start add our endpoint can just say up it will be also patch slash user
[00:28] id slash following all right after that we want to say that we want to have middleware also middleware controller finally specify the controller handler method
[00:57] which is can name we can name it following user somewhere else that i just save this go back to user controller as long as we can copy this one paste that here and start one by one with the documentation
[01:27] first the name should be following users or unfollow user we can pass this here on a summary I just say all right I want to clarify two points here
[01:55] related to this endpoint. This endpoint will be work for following and at the same time for unfollowing. How we can do this? We can just say, for example, require a Boolean through our faults, depending on the Boolean result, we can just start at follow a user or unfollow the user.
[02:24] or we can just try to pass the data the user.store want to follow the other or unfollow the other user and we can check that here logically for example if our user already following that user on that case we want to unfollow all right and if it not following this user
[02:52] want to make it start following that user. The other thing here that we are extracting the user that our main user ID from the authentication. We're all of course this to make sure that everything is secure 100%. We're all
[03:16] Now, what we want to have, we just ignore the description. Or, we just leave it. We can just come here and say follow or unfollow a user. Call or else. Produce JSON pair room.
[03:45] this will have param id pass strength through user id all right we only pass the second user id here on a pass everything nearly the same zipped this one so we all gonna to remove it but we can just duplicate this line
[04:12] this for success and this should be 200 200 sorry sorry sorry 200 alright and we just leave this map staying in office itself alright this finally the routes
[04:41] we will just change this we will say user slash id slash following and it will be patch as all we want to remove this one we didn't need it call and we can just start change the method name
[05:09] I can just say func following following users right the earth red line has been gone very well and just take this out or remove it just take it out alright
[05:38] and just start by extracting the first or having variables include models or type of models can just say war first user models user model I just duplicate this
[06:07] change this and instead of say first change this to second that's it now we want to extract the first user also put it on a primitive converted to primitive object ID to make it easy for us to search for that user by this ID can just say first
[06:37] user id underscore this all goes to primitive object id from hex say c.perms
[07:06] just duplicate this change this to second user ID which will equal all of this now we need to change this to see .locals user
[07:36] id and to say this string for all or else don't need now we want to get these two users okay how we are doing this if you go down down down down down down down down down down here
[08:04] Yep, here. We can copy this one. Come here, paste it here. Let's not change this first user ID. User ID. Yep. First user.
[08:33] right we want to have we should expect an error now we need to duplicate this one and change this second user ID we want to decode the second
[09:02] user call we need to remove this one and just come here simply we can copy this one and simply paste it here
[09:29] and we're good here now we want to have the user IDs as a strings so just say ferris to ID or equal because we will gonna need this to see .params ID
[09:58] What is that? Okay, let's just duplicate this one. Paste it here. Head save. We're called now. What is that? Unreachable code hell. Okay, I'm sorry. Let's just change all this. We want to have...
[10:27] We are returning an error without check the error f. This error is not equal to 0. On that case we want to return that. Now the suid or second user id will equal to c.locals user id
[10:56] string. now we want to check if our first user as follows contains the second user id. all right let me just come here and say f
[11:26] slice slices contains first user id dot followers okay and this sec uid suid or second
[11:55] user ID. Please note that the second user here is the user who start drawing to follow the first one. So we are checking if the first one followers has already this UID on the followers list.
[12:21] all right on that case we can just say oi which is a self-assembled variable we can just say sort search oops search strings and pass this first user
[12:50] followers as a first argument the second one will be s or second uid next we can just now say first user dot followers what equal to slice slices sorry dot delete
[13:17] We want to delete this first user Followers Pass this i, i plus 1 Alright, we want now to remove from the following list on second
[13:44] user we're just going to index this time which will equal or I believe we can do all this let's just copy this one paste it here
[14:09] change this eye to index right search this one will be second user ID following not floors okay which will take first
[14:37] first user ID or we name it F UID also we will nearly have the same so we can just copy this one instead rewrite it here we have second user
[15:06] load following this will be second user following and pass this index index plus on
[15:31] and this is how we are updating the first user followers list and second user following list by removing the second user id from it on the first case and on the second one not case firstly we are removing this second user id from
[15:59] first user followers Then we are removing the first user ID on this one all right who are if This doesn't contains if this this actually this conditional return false This is mean that we want to Update actually or append or add this IDs so we can just came here now and say else
[16:28] and on that case we want to come here and say first user dot followers will equal to append first user followers suid then we can say second user dot following which will equal append second user following
[16:58] F UID or first user ID. We're all now just add to ourself to do here. Just create Notification. We're all I believe that we are very close now. Yep, we didn't need all this. We just simply remove it.
[17:26] all right and now we all actually need to have a person with this new followers and new set operators can just come here and say up if you update first
[17:55] Okay, that's enough. I can just come here and say PISEL. M, the name is CONVENTION. And now I can just say FOLLOWERS. Okay, and I can just say FIRST USER.
[18:25] dot followers call then update second Peso.m following second user dot following
[18:54] with all now we want to I don't know have something like that may just simply copy all this alright and directly paste that here change this to internal server error and pass the error with this details
[19:22] all right just duplicate copy this another time and paste it again okay you know what I'm doing on a second just take this out and start from here remove this column and start from the point
[19:50] what we are actually trying to do is to update so let me just change these two to update one we are on the first case try to get first user id
[20:18] okay just select this one and remove it again select this one and remove it and start working here we are missing the last one which will be piston dot m dollar sign set update first
[20:46] well it look like we are having an issue here what is that assignment which is where the user returns to this error any let's just say data
[21:12] data-representer this-representer I don't know what is that okay just do it one by one this is an error okay assignment mismatch on variable bot user
[21:39] schema update on returns two values mm-hmm okay so why is this not working when we came here and pass x for example comma yeah look like this is working correctly we have now update result
[22:05] okay updated users came here or let's just say updated updated up first came here and say up
[22:33] second we need to define this all right now we need to copy in this one came down here past comma and past this which will be update second roll or call
[23:02] finally we can have something like that directly paste it here we are not need this one okay okay okay I can just say okay here on map we can just say second
[23:28] user pass up second all right and then have first user up first
[23:54] overall we're cool now we can test our endpoint all right we are sure need to article about hit make so granite run our app another time go back here copy the use of addition
[24:20] the token for our user or start login already did this and I logged now as or pass token for Ahmed if you go back here you will see that I go create another two users and the idea here that we want Ahmed to start following ISIL note that the following and followers list is empty on both of them
[24:47] What should happen now when we start hit on on execute Actually the Isle ID should be actually inside followers following list for Ahmad and Ahmad ID should be on followers list on Isle that's it and after that if we hit execute
[25:16] The IDs should be removed from both of them. Alright, let's just start to test this. Refresh. Go to the USB UI. Refresh the page. You'll see that we have this one. Hit on Tryout. Press the ID knob. We need to copy the ID correctly. We just copy this. Go back.
[25:44] Paste that here. Very well. Now hit on execute. Very well. This is what we have. This is the result that we got. This looks nice but we do actually want to return the user so let's just first check if everything works fine. Hit refresh. As you can see this now not empty. We have ISOID here.
[26:08] and on floors we have Ahmed ID here so our app nearly works fine just hit this one more time go back refresh this as you can see now both are empty on both of the users finally before we moving on we want to returns our users
[26:34] All righty, how we did this? Let's use our ID and second user ID. Just, no, no, no, no, no, no. Yeah, this one, this one, so. We want to execute this one more time. Go down here.
[27:00] based on that here remove this column and here we can just say first user I'm sorry second user here first user just let's see if we are having an error
[27:29] yep for that we can just pass underscore underscore since that is not new we need just to remove the column yep and after all we can just hit save wait until the app re-run now we can go back and hit on execute as you can see this now will return to us the first user
[27:58] having this following and this on followers this on followers and this on following execute again as you can see this has been removed execute again this has been added very well that look like that our app is all perfectly we can now move on to the next lecture
[28:18] you
