[00:00] hello and welcome on this lecture we will start fixing the bug that we faced on the last lecture and also getting the real-time notification here on notification component all right if you are looking if we go back and look at this you'll see that this doesn't update or fire this function unless this has been updated
[00:26] which means that this will never work whenever we go this will only work if we go a new function but there is another event that we can look for which is going to another route because this is the only way that the user can see the function which is changing the route we can detect this from the nav bar and then call that function once again
[00:53] but before this I think that we can simply also came up here remove this and call it from here can just came up here say await for this on raided
[01:20] notification count next we can come up here on watch and add another one dollar sign for route which I'm using function
[01:45] with no name, with no parameter, let's just start it dead, say un... no, I already did not sketch and count, by this way we can update it, when we make this read it, right, let's just test that, right now,
[02:12] we can add like we have one okay just add another one any this became two what if we came up here all right and then go back here as you can see this disappeared which is mean everything works fine now we need to just be able to get this new data on
[02:42] so we need to go to notification component and go to the notification component and now what we can do here is to get this notary at real time notify and watch it as well
[03:11] we can do nearly the same thing we just close this on a war we have real time we add this map state we can copy it go back on computed map getters we need to add map state
[03:40] realtime notify okay and we can write this down here at watch realtime notify this one dot or look for is notify data which is this one
[04:09] copy paste that here okay we need to add a comma of course and we can just say that we have an async function we should ignore the name this will give us new value
[04:37] and also old value we can keep this an empty or not just call it in a way old value what we can do here is to say new value this need to be fixed actually because this when when it come from the front backend
[05:04] from real time it give us details with different typing I just have simply a log here to see the difference so I can just say console log comment or sorry knotty new value
[05:31] head save now and go back we have all this map state is not defined all right where this map states define this one on this old we can keep it empty
[06:00] I don't know if we can ignore this or not let's just ignore it and see otherwise we will add a comment for aslint
[06:28] Where this old, we already updated this. Okay, we need to save. Going back, go to the notification, go and inspect console, you know, and just open the compass. Social notifications, and read this.
[06:58] ok, drop, go back, refresh, new feature list is empty, now we need to add this notification ok, we have another error here it is not a function, why?
[07:28] is related to the post we just fix it first components post post maybe post details okay this local post likes post details add
[07:57] okay just keep this at save now we need to go back dislike this notafunction okay let's just go on back to see what is the problem here
[08:19] just remove this question mark and i think that we have a type of here this is filter not filtered now head save go back try to unlike or like okay this should give us the notification here and the object the notification object as you can see it is printed here okay
[08:47] not where where where the details is different than that we have so that's why we need to change it when we work on that we can say is new value details we can call it notify and instead of this new value okay notify details
[09:17] on equal to notify lot dtails by this way no details dtails because this is how you written this after that you can just say this notify list unchecked and pass this
[09:46] notify it on right we need to test that now go back refresh okay we need to make this small take it on the right now just to start the other comment hello hit add as you can see we are in this one I saw
[10:15] but without something is not right wet, wet, wet, wet the avatar why is that? we need to look at this also where this notify yeah I think we make this avatar T or something like that
[10:44] head save going back ok refresh right on like and then now we want to hit like ok this is still not working correctly as we expect
[11:13] okay that's having because we are looking for user it is inside user so we need to change this to user okay let's just test this once again another comment next okay this is still not working correctly in expect
[11:43] The problem is that the avatar doesn't see on the backend. This is the problem. It does not work from the backend side.
[12:12] So that's all you need to work on that on a vacant Okay, if we stop this adjust this one more time Refresh Okay, close this
[12:39] go back here add comment say hh hh hh and check this out this object you'll see that we have the avatar without any problem okay
[13:05] what if we did this? does this make any difference? call this from around again we don't have it here on object, no it doesn't make any difference
[13:33] okay now if we say notify user avatar change to avatar the head save
[14:00] call this once again going up here looking for an object now it became an undefined and it is still called avatar yeah okay what if we came up here say notify
[14:27] not user, not avatar, t make it equal to anything and hit save and then go on back and this, this once again see what I will have, okay it is avatar, t and this one is on the globe
[14:54] That's great, now can we come up and copy this, paste that here, say honest notifoy equal to this notifoy.
[15:19] or can we just say delete notify avatar and simply use this directly we just test it okay I know I need to remove this once again
[15:43] Refresh, remove these notifications. Now I will try to add like. Alright, it worked perfectly. Add comment. Still worked perfectly. Refresh.
[16:12] okay it is great now we need to test the last thing which is like or sorry which is what it called actually I don't remember yeah sorry follow and unfollow need to go up here check
[16:37] whether this one work or not one is unfollow, shouldn't work, but two is follow, should work. Okay, that's great. We're all, I think we're cool, we're very cool. We need to look at that now, if we change this, now it is disappear. We are very cool. Our notification real-time notification system works perfectly.
[17:02] And now we can just move on to the next lecture and work on a real time chat. So see you on the next lecture.
[17:11] you
