[00:00] All right, so now let's also implement the delete RPC for execs as well as students and let's copy this to execs Actually, we are not going to start with RPC. We first need to implement the We first need to implement the database operation So let's copy delete teachers from DB
[00:29] Paste it into xxgrad. And let's replace the instances of teacher.
[00:36] with exec.
[01:02] Great and now we're done. Now let's copy this over to student's crowd.
[01:32] you
[01:39] And now again do the replacement.
[02:08] and we're done save it and now we can implement the RPC so
[02:35] let's go back to teachers copy this and now let's get to your execs handlers and paste this here
[03:00] and actually instead of v we are going to use exec because that improves readability v doesn't mean anything so exec.id
[03:27] and let's change this in the teacher's file as well and now let's get back to execs.co and and do the remaining changes
[03:53] all right and we're done so let's save this and copy this too
[04:09] students.
[04:36] great and we're done let's save this and
[05:05] restart the server all right and let's send a request and for that we need the id so for execs we are going to create a new exec and then delete that so add execs
[05:34] And invoke. Oh, okay. All right. We have other values as well. Okay, let's invoke this now. Here we go. And now you're going to delete this. Delete execs.
[05:58] Let's first see this in the collection. And here it is. And we see that the user created field is overwritten by our value from the API. And the same for inactive status.
[06:26] Alright, so let's delete this and this exec is successfully deleted. Let's refresh and it's gone. Now for students.
[06:46] again let's add a student let's see if it's at the end they are probably
[07:14] Yes, it is at the end. Here it is. And now let's delete this. Delete students. And hit control enter. And the student is successfully deleted. Let's see. So refresh.
[07:43] And let's go to the last page. And we don't have that entry. Great. Great. So our delete RPCs are also working perfectly.
[08:02] you
