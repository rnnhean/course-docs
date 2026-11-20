[00:00] hello and welcome my dear student as we already spoke before when we talk about the structure we said that we want to get our user friends but for now to be able to handle our real time correctly we can mock this so this is exactly what we are going to do on this lecture is to mocking get user friends until we move to the next phase of creating chrpc connection
[00:28] for now we can just create a new package let's just call it realtime inside of this we just say friends.go package realtime and what we can do here is to make a function we'll just call it git
[00:55] user friends okay and this should simply expect user ID which is string which is actually part of channel let's say we're return channel
[01:23] chain of array of string all right after that we can just create a channel say make channel array of string and here we can just use go routine for making a function
[01:52] sorry function first of all we want to close this so we can just say defer close this channel after that we can just use switch statement of this user ID first case if that user ID is 1
[02:19] on that case we can just say that channel will have this array of string we can just say 2, 3 we are just saying that this is simple id's ok now we need to duplicate this
[02:47] to have multiple cases actually oops all right if our user or the user ID is too
[03:16] we want to make the friends for that user 1 and 3 and 4 in case that our user connect with ID3 we want to make a friends for him just 1 and 2 and 4 as all alright what
[03:45] fdusers is false ok on that case we want to make just one friend for him which is user number one ok this is just for testing purposes it is not so specific but just for testing so we can just hl on that case on the default one would be just
[04:14] oops what the hell is that? it will be just slides off string or a off an empty string okay short call very cold or after that we can just a recall it right now
[04:39] we can just come after all and say please return that channel all right our mock get user friends is ready on the next lecture we want to start building the manager which will be responsible for sending messages correctly saving messages create a specific connection that related
[05:08] to our user id use this function to get user friends notify our user it will be actually the real handler of nearly all the operations so let's just move on to the next lecture and start our conduct
[05:26] you
