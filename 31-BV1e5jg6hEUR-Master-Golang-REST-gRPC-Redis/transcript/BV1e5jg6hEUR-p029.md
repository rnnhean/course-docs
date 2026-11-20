[00:00] hi and welcome on this lecture we will start creating our last endpoint here which is for mark message as we did we just start by going to the chat routes all right and we can just start by define the new route we can just here say up
[00:29] get slash shut slash mark message or MSG as read it controller mark MSG as read it
[00:58] all right now let's just go back copy this code just paste it here copy this one and go up here change this as well all right and I just start from the beginning this one is called mark
[01:28] message has read it now the error has been gone then copy this one paste that here and note what this should exactly did if we check the yeah if we try to mark messages read
[01:57] this will actually happen when our user starts open the shop box between him and other users so this should actually create that record if it not exist if we say that our main user is this one and the other user include this one include this ID i mean second thing that we need to do we need to change this to true
[02:26] and make this number zero number of hundred messages zero we're all so we just store complete this we can just say mark messages as read for users
[02:52] update the record make a sheet to num0 all right then we have nearly everything is the same except this one just duplicate it
[03:20] we need to get the main UID and the other UID this will be the main user ID and this will be other user ID overall
[03:49] then here we need to duplicate this this should be main UID and this other UID and you know we can here and say main UID
[04:19] if this equals empty or other UID equal equal empty string on that case we can just say user main ID main AIN UID and other user ID core perms is record
[04:48] all right after that on the filter we need to have also filter here but this filter is different first we need to have the same main UID all right we can just skip here same main UID all right tutorials the other is already
[05:17] should be this other user ID but here we need to have update because we need to update pson.m can you set operator pson.m on to update this
[05:46] as readed we want to make this true through no track and the num of unreaded messages we need to make sure that we got the same name we can
[06:16] copy this embassy dot here we want to make this zero very well now we can just update the document we can just here say options or b options dot find
[06:46] on and update and say set absurd true so if it not exist it will be created set return document options after roll now we can just give here no need to have all this so just ignore all this
[07:16] okay just here and say result all equal to this already the message schema don't find one an update bus the contacts ctx bus the filter
[07:43] pass the update and finally we can pass the options all right now we can just come here say f result dot error not equal to nil on that case we can just copy this
[08:13] on here paste it here the message will be fail to mark mark message as I read it and the error here can be just result dot error dot
[08:43] error exactly like that finally we can just check if the document was created or updated just say check you can just say war update doc you can just say pass on dot m say f error goes to result
[09:13] not decode this update and update look are not equal to nil all right we can just on that keys have something similar of this so we just copy and paste it here
[09:40] unchange this actually both of them internal server errors this one will be failed to decode updated document
[10:05] all right after all we can just keep here and say is more cut update doc not equal no assemble is that and after all we just return is more cut
[10:35] and then this is marked sorry is marked yep this one now we can just save all and let's go back here around this logo look like everything is correct mark as read alright look like everything is alright
[11:04] now let's just go back here and hit on execute on this function yeah because we didn't run this just refresh this one where mark message as read okay now hit on execute as you can see we have this ones here
[11:31] all right we just test this one which is for Ahmad I don't know it's different anyway we just hit on execute now this one's here copy it please paste that here hit on execute as you can see this is all we have
[12:00] so the main idea here that if we start for example make this mark as read it when we run this one more time we should only get this one and the also if we get this so adjust this this one let refresh try out this is main user ID going back copy this one the other user ID
[12:30] now if we hit on execute go back here and say hit execute this should disappear now and this will not remove the document it will just convert this to 0 and this to true and this total number will equal to 9 I just test it anyway hit on execute we got is marked is true if you go here just if you refresh
[12:57] as you can see one of them yeah this one converted to true and this to zero now go back here on this endpoint for getting our needed messages now head on execute as you can see this has been disappeared and this is exactly what we want i believe that our endpoint worked perfectly our total clock work great so
[13:25] we can just now move on to the next lecture so see you on the next lecture
[13:30] you
