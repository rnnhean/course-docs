[00:00] hi and welcome on this lecture we will start actually create our last endpoint on our user it is not here on the software editor that I have made it before actually forgot but we need to add it which is actually for delete user where I will just start by going to our code go to the user routes
[00:26] and start at the same point at the end here just copy this one paste that here and just change this to slash delete
[00:51] which of course need to have this os metal wire and this one instead of being batch it should be the lead all right I think now we need to change this one yep
[01:18] to delete user head save and go to the user controller and want to copy not following we need to copy the update yes
[01:45] yeah I think that we need to copy this one I'm not sure actually no we can just copy this one for update go down here and we can make this we can paste that here
[02:13] change this to instead of update user to delete user there now should disappear from here yep we just start working on it one by one this one is delete summary delete user data delete user details nope
[02:42] delete user not user data it is actually just user all right after that we have on param id yes belong to this user id we don't have this one we do have 200 response nope we can just copy this response paste
[03:11] dot here this one's not actually it is actually delete and we need to change this to delete yep it is exactly like this of course we need to have the pair of os
[03:36] all right now let's just say that we are saying that we have this user schema we get this contacts have the deferred after that we try to extract the user ID from the
[03:57] the pass it should pass it to us from our os middleware or our os controller no no from os middleware yep after that we want to check this and we can just change this message to you are not authorized to delete this user
[04:24] right just now remove the rest okay and do we have we need just to convert this to a primitive object holiday for that we can just copy this one
[04:52] paste that here change this to user id and here we can pass the not perms id of course we can use this variable as well
[05:20] i just take this out for now and we can just have any kind of error just copy it on base.here we can just say successful message we can say invalid user id
[05:44] right after that we want to be sure that we deleted correctly just a result error user schema dot delete1 nope delete1 pass the contacts as well as the person dot m
[06:12] of this underscore id pass user id toy oops we want to pass this one yeah just paste that here okay okay we are not we will never reach to this because we want to define the error here
[06:41] and say f.error not equal to nil please on that case return to us this message and after that we have this user id and just copy and paste that here and now we need also to fix this this is not common this column
[07:10] right everything now is fine now we need to grab this the zone paste that here and we can just say fail to delete user sorry the delete
[07:38] user the zone can be internal server error can pass error error dot error we're all after that we can just continue and say f the result dot delete count is equal equal sorry zero
[08:08] on that case we need to return something similar just copy this one paste that here and say not found we can just say user not found and we didn't have error here so we need to remove this one and after all we can return something like that let's just come here
[08:37] say success all right here we can just say status look we want to say success is stress not stress what distress true and we can just say user user
[09:04] deleted successfully all right I believe that's all now we just hit on save and just make sure that everything is correct well this one the retweets our tongues paramaghi no no no no no delete all right I think everything is okay
[09:33] we need now to run our swagger documentation helper file helper script we don't know that now we can just say error run our application go back adjust saving the
[09:59] token here now we need to hit refresh we got now new point so just try to test it first of all we need to pass the token, hit authorize, hit close all right now we need to go to the Mongo Compass
[10:24] try to remove this user ID this token actually that we logged in with belong to Ahmad so let's just now start grab this token hit on try out paste that here hit on execute as you can see this gives us an error you are not authorized to delete this user of course if we try this as Ahmad this will uh successfully
[10:52] but if we are actually now want to remove this one so we just copy copy the credentials for this user try to sign in hit on try out just paste that here say Ahmed 555 hit on execute
[11:21] we need now to copy all this I don't authorize logout authorized close and let's just now try to delete this one hit on execute as you can see user deleted successfully we need to fix this ones here
[11:51] i just now check how many records we have just hit on refresh as you can see this now became 3 the M user has been disappeared overall i think that's all we need to do on this lecture we can now move on to the next
[12:12] Thank you.
